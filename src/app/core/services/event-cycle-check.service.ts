import { Injectable } from "@angular/core";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "./data.service";

/**
 * Refuses an edit that would make an event contain itself.
 *
 * docs/TODO.md asks for a circular-reference check on the event tree, flagged as high importance:
 * a cycle in hasEvent has no meaning as a hierarchy and hangs the tree, which walks hasEvent
 * recursively with no notion of a path (see grepId2Event and _mergeLocalChangesToEventTree in
 * InstanceUtilities, and MatTreeFlattener in EventTreeComponent).
 *
 * What is refused, and why only this much:
 *
 * - **hasEvent** — an event may not be added to itself, nor to any event it already contains.
 *   There are no hasEvent cycles at all in the curation database (checked over Bolt), so this
 *   forbids nothing curators do today.
 * - **precedingEvent** — only a self-reference is refused. Longer cycles are *not*, because they
 *   are ordinary biology and the database is full of them: 593 events sit in a two-event
 *   precedingEvent cycle and 1369 in a cycle of six events or fewer - a kinase and the phosphatase
 *   that reverses it precede each other, and the POU5F1/SOX2/NANOG regulatory loop is a cycle by
 *   design. Blocking those would refuse edits curators legitimately make. (The 7 events in the
 *   database that precede *themselves* are data errors; those this does refuse.) Whether a longer
 *   precedingEvent cycle deserves a warning is a curation question, not one to settle here.
 *
 * The hasEvent containment check reads the event tree that DataService has already loaded, which
 * is the only complete hasEvent hierarchy the front end holds; it covers staged edits made through
 * the event tree, since EventTreeComponent keeps that structure up to date as it is edited. If the
 * tree has not been loaded in this session - possible in the schema view - only the
 * self-reference check runs, rather than pulling the whole tree over the wire to validate one
 * edit. Building a cycle then takes two edits from two different parents, each of which is
 * refused once the tree is loaded, and the recursion guards named above stop a cycle that slips
 * through from hanging the tree.
 */
@Injectable({
  providedIn: 'root'
})
export class EventCycleCheck {

  constructor(private dataService: DataService) {
  }

  /**
   * The reason this addition must be refused, or undefined if it is fine. The message is written
   * for the curator; callers show it and leave the attribute untouched.
   */
  checkAddition(instance: Instance | undefined, attributeName: string, values: any): string | undefined {
    if (!instance)
      return undefined;
    if (attributeName !== 'hasEvent' && attributeName !== 'precedingEvent')
      return undefined;
    const added: Instance[] = (Array.isArray(values) ? values : [values]).filter(value => value?.dbId !== undefined);

    for (const value of added) {
      if (value.dbId === instance.dbId)
        return `"${this.name(instance)}" cannot be its own ${attributeName}.`;
    }
    if (attributeName !== 'hasEvent')
      return undefined;

    for (const value of added) {
      const path = this.findContainmentPath(value.dbId, instance.dbId);
      if (path)
        return `"${this.name(value)}" already contains "${this.name(instance)}"`
          + ` (${path}), so adding it here would put "${this.name(instance)}" inside itself.`;
    }
    return undefined;
  }

  private name(instance: Instance): string {
    return `${instance.displayName ?? 'unknown'} [${instance.dbId}]`;
  }

  /**
   * Looks for descendantDbId under ancestorDbId in the loaded event tree, returning the path
   * between them (for the message) or undefined if there is none - including when the tree has
   * not been loaded, or holds neither event.
   */
  private findContainmentPath(ancestorDbId: number, descendantDbId: number): string | undefined {
    const root = this.dataService.getLoadedEventTree();
    if (!root)
      return undefined;
    // The same event can appear under several parents, so every occurrence of the ancestor has to
    // be searched, not just the first.
    for (const occurrence of this.findOccurrences(root, ancestorDbId)) {
      const path = this.findPathDown(occurrence, descendantDbId, []);
      if (path)
        return path.map(event => event.displayName ?? event.dbId).join(' > ');
    }
    return undefined;
  }

  private findOccurrences(event: Instance, dbId: number, found: Instance[] = [], path: Set<Instance> = new Set()): Instance[] {
    if (path.has(event))
      return found; // Already broken; leave the reporting to the tree's own guards
    if (event.dbId === dbId)
      found.push(event);
    path.add(event);
    for (const child of this.children(event))
      this.findOccurrences(child, dbId, found, path);
    path.delete(event);
    return found;
  }

  /** The chain of events from event down to dbId, both included, or undefined if it is not below it. */
  private findPathDown(event: Instance, dbId: number, ancestors: Instance[]): Instance[] | undefined {
    if (ancestors.includes(event))
      return undefined; // Already broken; see above
    const path = [...ancestors, event];
    for (const child of this.children(event)) {
      if (child.dbId === dbId)
        return [...path, child];
      const found = this.findPathDown(child, dbId, path);
      if (found)
        return found;
    }
    return undefined;
  }

  /**
   * The children of an event as the event tree holds them. Instances in the tree carry their
   * attributes as a plain object rather than a Map - see
   * InstanceUtilities.toEventTreeInstance - but read both, since this is also given the instance
   * being edited, which comes from the cache.
   */
  private children(event: Instance): Instance[] {
    const value = event.attributes instanceof Map
      ? event.attributes.get('hasEvent')
      : event.attributes?.['hasEvent'];
    if (!value)
      return [];
    return (Array.isArray(value) ? value : [value]).filter(child => child?.dbId !== undefined);
  }
}
