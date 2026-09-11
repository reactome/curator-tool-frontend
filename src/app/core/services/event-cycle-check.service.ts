import { Injectable } from "@angular/core";
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from "rxjs";
import { Instance, Referrer } from "../models/reactome-instance.model";
import { DataService } from "./data.service";

/**
 * Refuses an edit that would make an event contain itself.
 *
 * docs/TODO.md asks for a circular-reference check on the event tree, flagged as high importance:
 * a cycle in hasEvent has no meaning as a hierarchy, and it is not survivable - the backend's
 * getEventTree walks hasEvent recursively with no notion of a path, so one cyclic relationship
 * makes /getEventTree fail for every user until it is removed, and the event view has no
 * hierarchy to show at all. The front end cannot repair that after the fact; the edit has to be
 * refused before it is made.
 *
 * What is refused, and why only this much:
 *
 * - **hasEvent** - an event may not be added to itself, nor to any event that already contains it
 *   (directly or at any depth); the message names the containment path so the curator can see why.
 * - **precedingEvent** - only a self-reference is refused. Longer cycles are *not*, because they
 *   are ordinary biology and the database is full of them: 593 events sit in a two-event
 *   precedingEvent cycle and 1369 in a cycle of six events or fewer - a kinase and the phosphatase
 *   that reverses it precede each other, and the POU5F1/SOX2/NANOG regulatory loop is a cycle by
 *   design. Blocking those would refuse edits curators legitimately make. (An event that precedes
 *   *itself* is always an error, and that this does refuse.) Whether a longer precedingEvent cycle
 *   deserves a warning is a curation question, not one to settle here.
 *
 * Containment is decided by walking *up* from the event being edited through its hasEvent
 * referrers, not by reading the loaded event tree. The tree looked like the cheaper source - it is
 * already in memory - but it is only there once something has fetched it, which only
 * EventTreeComponent does; an edit made from the schema view (list instances, open a pathway, add
 * to hasEvent) had no tree to consult and so was never checked for containment at all. That is how
 * a cycle got committed. DataService.getReferrers answers the same question from the database
 * wherever the curator is working, and merges the session's staged edits, so a parent link added or
 * removed but not yet committed counts exactly as the curator sees it.
 *
 * Walking up is what keeps this affordable: an event's ancestors are a handful of pathways
 * thinning out towards the top-level ones, whereas walking down from the event being added covers
 * everything beneath it - the whole of Metabolism, for a top-level pathway. If the ancestry cannot
 * be established - the lookup failed, or the walk hit one of the limits below - the edit is refused
 * rather than allowed: a hasEvent edit is deliberate and infrequent, so asking the curator to retry
 * costs far less than a cycle that takes the hierarchy down.
 */
@Injectable({
  providedIn: 'root'
})
export class EventCycleCheck {

  /**
   * How far above the edited event the walk will climb. Measured over the curation database, the
   * longest chain from a top-level pathway down to a leaf event is 13 hops and nothing exceeds 14,
   * so no real ancestry comes close to this; it is only here so a hierarchy that is already cyclic
   * cannot climb for ever.
   *
   * It also has to stay small for a second reason: each level is a nested observable, and RxJS
   * silently drops the result of a synchronous chain several hundred levels deep (the emission
   * never arrives and the observable never completes) rather than reporting a stack overflow. A
   * level here can resolve synchronously - a parent lookup shared with an earlier level replays
   * from the cache - so a limit in the hundreds would risk a check that simply never answers.
   */
  private static readonly MAX_LEVELS = 30;

  /**
   * How many distinct ancestors the walk will read before giving up. Bounds the breadth the same
   * way MAX_LEVELS bounds the depth: an event has at most 11 parents in the curation database and
   * 0.9 on average, so a real ancestry is a few dozen events at most.
   */
  private static readonly MAX_ANCESTORS_VISITED = 300;

  constructor(private dataService: DataService) {
  }

  /**
   * The reason this addition must be refused, or undefined if it is fine. The message is written
   * for the curator; callers show it and leave the attribute untouched.
   */
  checkAddition(instance: Instance | undefined, attributeName: string, values: any): Observable<string | undefined> {
    if (!instance)
      return of(undefined);
    return this.checkAdditions([instance], attributeName, values).pipe(
      map(refusals => refusals.get(instance.dbId))
    );
  }

  /**
   * The same check for a batch edit, which puts one value onto many instances at once - the case
   * where a circular reference is easiest to create without noticing. Returns a message per
   * instance dbId, holding only the instances that must be refused; an attribute that cannot make
   * an event contain itself resolves immediately, without touching the network.
   */
  checkAdditions(instances: Instance[], attributeName: string, values: any): Observable<Map<number, string>> {
    const refusals = new Map<number, string>();
    if (attributeName !== 'hasEvent' && attributeName !== 'precedingEvent')
      return of(refusals);
    const added: Instance[] = (Array.isArray(values) ? values : [values]).filter(value => value?.dbId !== undefined);
    if (added.length === 0 || instances.length === 0)
      return of(refusals);

    for (const instance of instances) {
      if (added.some(value => value.dbId === instance.dbId))
        refusals.set(instance.dbId, `"${this.name(instance)}" cannot be its own ${attributeName}.`);
    }
    if (attributeName !== 'hasEvent')
      return of(refusals);

    // One cache for the whole batch: sibling instances in a batch usually share most of their
    // ancestry, so each parent lookup is made once however many instances need it.
    const parentCache = new Map<number, Observable<Instance[]>>();
    const toCheck = instances.filter(instance => !refusals.has(instance.dbId));
    if (toCheck.length === 0)
      return of(refusals);

    return forkJoin(toCheck.map(instance =>
      this.findContainingEvent(instance, added, parentCache).pipe(
        map(refusal => {
          if (refusal)
            refusals.set(instance.dbId, refusal);
        })
      )
    )).pipe(map(() => refusals));
  }

  private name(instance: Instance): string {
    return `${instance.displayName ?? 'unknown'} [${instance.dbId}]`;
  }

  /**
   * Looks for any of `added` among the ancestors of `instance`, returning the message to refuse
   * the edit with - naming the containment path - or undefined if none of them contains it.
   */
  private findContainingEvent(instance: Instance, added: Instance[],
    parentCache: Map<number, Observable<Instance[]>>): Observable<string | undefined> {
    const wanted = new Map<number, Instance>(added.map(value => [value.dbId, value]));
    // Each entry is an event still to be looked above, with the chain from it down to the event
    // being edited, so that a hit can be reported as the path the curator would have created.
    let frontier: { event: Instance, chain: Instance[] }[] = [{ event: instance, chain: [instance] }];
    const visited = new Set<number>([instance.dbId]);
    let level = 0;
    let gaveUp = false;

    const climb = (): Observable<Instance[] | undefined> => {
      if (frontier.length === 0)
        return of(undefined);
      if (++level > EventCycleCheck.MAX_LEVELS
        || visited.size > EventCycleCheck.MAX_ANCESTORS_VISITED) {
        console.warn(`EventCycleCheck: gave up ${level} levels and ${visited.size} events above`
          + ` ${this.name(instance)}; the hierarchy above it may already be circular.`);
        gaveUp = true;
        return of(undefined);
      }
      return forkJoin(frontier.map(step =>
        this.parentEvents(step.event, parentCache).pipe(map(parents => ({ step, parents })))
      )).pipe(switchMap(results => {
        const next: { event: Instance, chain: Instance[] }[] = [];
        for (const { step, parents } of results) {
          for (const parent of parents) {
            const chain = [parent, ...step.chain];
            if (wanted.has(parent.dbId))
              return of(chain);
            // An event with more than one parent is normal in Reactome, so the same event can be
            // reached by several routes; only the first needs following.
            if (!visited.has(parent.dbId)) {
              visited.add(parent.dbId);
              next.push({ event: parent, chain: chain });
            }
          }
        }
        frontier = next;
        return climb();
      }));
    };

    return climb().pipe(
      map(chain => {
        if (!chain)
          return gaveUp ? this.unverifiable(instance) : undefined;
        const container = wanted.get(chain[0].dbId)!;
        const path = chain.map(event => event.displayName ?? event.dbId).join(' > ');
        return `"${this.name(container)}" already contains "${this.name(instance)}"`
          + ` (${path}), so adding it here would put "${this.name(instance)}" inside itself.`;
      }),
      catchError(error => {
        console.error('EventCycleCheck: could not read the events above '
          + this.name(instance), error);
        return of(this.unverifiable(instance));
      })
    );
  }

  /**
   * Refusal used when containment could not be established either way. Deliberately not silent:
   * allowing the edit is what let a cycle reach the database, and a cycle is not repairable from
   * the front end once committed.
   */
  private unverifiable(instance: Instance): string {
    return `Could not check whether this would make "${this.name(instance)}" contain itself,`
      + ` because the events above it could not be read. The edit has not been made; please try`
      + ` again.`;
  }

  /**
   * The events holding this one in their hasEvent, from the database and from this session's
   * staged edits (see DataService._getReferrers, which merges both and drops instances marked for
   * deletion). Shared through `parentCache` so an ancestor reached by several routes, or shared by
   * several instances of a batch, is fetched once.
   */
  private parentEvents(event: Instance, parentCache: Map<number, Observable<Instance[]>>): Observable<Instance[]> {
    const cached = parentCache.get(event.dbId);
    if (cached)
      return cached;
    const parents = this.dataService.getReferrers(event.dbId).pipe(
      map((referrers: Referrer[]) => referrers
        .filter(referrer => referrer.attributeName === 'hasEvent')
        .flatMap(referrer => referrer.referrers)
        .filter(parent => parent?.dbId !== undefined)),
      shareReplay(1)
    );
    parentCache.set(event.dbId, parents);
    return parents;
  }
}
