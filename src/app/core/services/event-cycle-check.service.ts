import { Injectable } from "@angular/core";
import { Instance } from "../models/reactome-instance.model";

/**
 * Refuses an edit that puts an event directly into its own hasEvent or precedingEvent.
 *
 * This used to refuse containment at any depth as well: adding an event to anything that already
 * contained it, established by walking *up* through the event's hasEvent referrers. That was
 * correct but it cost a request per ancestor on every hasEvent edit - a batch edit over a few
 * hundred instances, which is where a cycle is easiest to create by accident, could take hundreds
 * of them - and it had to refuse the edit whenever the ancestry could not be read, so a network
 * blip blocked legitimate curation.
 *
 * Cycles are now allowed to be created and reported afterwards instead, in the one place that
 * needs the hierarchy to be a hierarchy: the event view. `getEventTree` drops the relationship
 * that closes a cycle and returns it (see the backend's EventTree), and
 * InstanceUtilities.mergeLocalChangesToEventTree does the same for cycles that this session's
 * uncommitted edits create, so EventTreeComponent can name the containment path the curator has
 * to break. Nothing is lost from the hierarchy in the meantime - the rest of the tree still loads
 * - and no request is made to find out.
 *
 * What is left here is the part that costs nothing: an event listed in its own hasEvent or
 * precedingEvent is a comparison of two dbIds, so it is still worth catching at the moment the
 * curator does it rather than the next time they open the event view.
 *
 * Longer precedingEvent cycles are deliberately *not* refused, and never were: they are ordinary
 * biology and the database is full of them - 593 events sit in a two-event precedingEvent cycle
 * and 1369 in a cycle of six events or fewer, because a kinase and the phosphatase that reverses
 * it precede each other, and the POU5F1/SOX2/NANOG regulatory loop is a cycle by design.
 */
@Injectable({
  providedIn: 'root'
})
export class EventCycleCheck {

  /**
   * The reason this addition must be refused, or undefined if it is fine. The message is written
   * for the curator; callers show it and leave the attribute untouched.
   */
  checkAddition(instance: Instance | undefined, attributeName: string, values: any): string | undefined {
    if (!instance)
      return undefined;
    return this.checkAdditions([instance], attributeName, values).get(instance.dbId);
  }

  /**
   * The same check for a batch edit, which puts one value onto many instances at once. Returns a
   * message per instance dbId, holding only the instances that must be refused.
   */
  checkAdditions(instances: Instance[], attributeName: string, values: any): Map<number, string> {
    const refusals = new Map<number, string>();
    if (attributeName !== 'hasEvent' && attributeName !== 'precedingEvent')
      return refusals;
    const added: Instance[] = (Array.isArray(values) ? values : [values]).filter(value => value?.dbId !== undefined);
    if (added.length === 0 || instances.length === 0)
      return refusals;

    for (const instance of instances) {
      if (added.some(value => value.dbId === instance.dbId))
        refusals.set(instance.dbId, `"${this.name(instance)}" cannot be its own ${attributeName}.`);
    }
    return refusals;
  }

  private name(instance: Instance): string {
    return `${instance.displayName ?? 'unknown'} [${instance.dbId}]`;
  }
}
