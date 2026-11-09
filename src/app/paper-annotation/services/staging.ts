import { SessionUserInstances } from '../models/llm-api.models';

/** localStorage key holding the id of the annotation session whose instances were last loaded into staging. */
export const LOADED_SESSION_KEY = 'paperAnnotation.loadedSession';

/**
 * localStorage key holding, for the instances last loaded into staging, the dbId each was given here mapped to the
 * dbId the annotation service exported it with: { "<staged dbId>": <exported dbId> }. A loaded instance is renumbered
 * (renumberNewInstances), but the service finds its evidence by the exported dbId (exportedDbIdOf).
 */
export const LOADED_DB_IDS_KEY = 'paperAnnotation.loadedDbIds';

/** The dbId the annotation service knows a staged instance by: the exported one if it was renumbered on load. */
export function exportedDbIdOf(stagedDbId: number): number {
  try {
    const map = JSON.parse(localStorage.getItem(LOADED_DB_IDS_KEY) ?? '{}');
    const exported = map?.[String(stagedDbId)];
    return typeof exported === 'number' ? exported : stagedDbId;
  } catch {
    return stagedDbId;
  }
}

/** localStorage key prefix for the reactions a curator checked to load, per annotation session. */
export const CHECKED_REACTIONS_KEY = 'paperAnnotation.checkedReactions.';

/**
 * Event classes. Collecting what a reaction needs stops at these: another reaction is never pulled in because a
 * checked one points at it (precedingEvent, for example), and the annotation's pathway only comes when asked for.
 */
const PATHWAY_CLASSES = new Set(['Pathway', 'TopLevelPathway']);
const EVENT_CLASSES = new Set([
  'Reaction', 'BlackBoxEvent', 'Polymerisation', 'Depolymerisation', 'FailedReaction', 'ReactionlikeEvent',
  'Pathway', 'TopLevelPathway', 'CellLineagePath', 'CellDevelopmentStep', 'Event'
]);

type Ref = { dbId: number; schemaClassName?: string };
type Exported = { dbId: number; schemaClassName: string; attributes?: Record<string, unknown> };

const isRef = (v: unknown): v is Ref => !!v && typeof v === 'object' && typeof (v as Ref).dbId === 'number';

/** Every instance an attribute value points at. */
function refsOf(i: Exported): Ref[] {
  const out: Ref[] = [];
  for (const v of Object.values(i.attributes ?? {})) (Array.isArray(v) ? v : [v]).forEach(x => { if (isRef(x)) out.push(x); });
  return out;
}

/**
 * The part of an annotation's export that loads only the given reactions: each one with every new instance it
 * needs (participants and their components, catalyst activities, regulations, summations, modified residues).
 * An entity two reactions share comes once. The annotation's pathway comes only with `withPathway` (the curator
 * checked every reaction), with what it needs; its hasEvent keeps just the loaded reactions. A reference to an
 * instance left out (an unchecked reaction, the pathway) is removed, so the result is self-contained like a full export.
 *
 * Works on the export as the service sends it (attributes as plain objects) and keeps every dbId, which is how
 * a loaded instance's evidence is found. The input is not changed.
 */
export function selectReactions(exported: SessionUserInstances, reactionDbIds: number[], withPathway = false): SessionUserInstances {
  const all = exported.newInstances as unknown as Exported[];
  const byId = new Map(all.map(i => [i.dbId, i]));
  const isEvent = (i: Exported) => EVENT_CLASSES.has(i.schemaClassName);
  const chosen = new Set(reactionDbIds.filter(id => byId.has(id)));

  // A regulation may point at its reaction without the reaction pointing back; it still belongs to the reaction.
  const pointingAt = new Map<number, Exported[]>();
  for (const i of all) {
    if (isEvent(i)) continue;
    for (const r of refsOf(i)) if (chosen.has(r.dbId)) pointingAt.set(r.dbId, [...(pointingAt.get(r.dbId) ?? []), i]);
  }

  const keep = new Set<number>(chosen);
  const stack: Exported[] = [...chosen].map(id => byId.get(id)!);
  if (withPathway && chosen.size) {
    all.filter(i => PATHWAY_CLASSES.has(i.schemaClassName)).forEach(p => { keep.add(p.dbId); stack.push(p); });
  }
  chosen.forEach(id => (pointingAt.get(id) ?? []).forEach(i => { if (!keep.has(i.dbId)) { keep.add(i.dbId); stack.push(i); } }));
  while (stack.length) {
    for (const r of refsOf(stack.pop()!)) {
      const target = byId.get(r.dbId);
      if (!target || keep.has(r.dbId) || isEvent(target)) continue;
      keep.add(r.dbId);
      stack.push(target);
    }
  }

  // Existing Reactome instances (dbId > 0) are always kept as references; new ones only when loaded.
  const loaded = (r: Ref) => r.dbId > 0 || keep.has(r.dbId);
  const prune = <T extends Exported>(i: T): T => {
    let changed = false;
    const attributes: Record<string, unknown> = {};
    for (const [name, v] of Object.entries(i.attributes ?? {})) {
      if (Array.isArray(v)) {
        const kept = v.filter(x => !isRef(x) || loaded(x));
        if (kept.length !== v.length) changed = true;
        if (kept.length) attributes[name] = kept;
      } else if (isRef(v) && !loaded(v)) {
        changed = true;
      } else {
        attributes[name] = v;
      }
    }
    return changed ? { ...i, attributes } : i;
  };

  return {
    ...exported,
    newInstances: all.filter(i => keep.has(i.dbId)).map(prune) as any,
    updatedInstances: (exported.updatedInstances as unknown as Exported[]).map(prune) as any,
    bookmarks: (exported.bookmarks as unknown as Ref[]).filter(loaded) as any,
  };
}

/**
 * Give every new instance of a load (dbId < 0) a dbId from `fresh`, in order, and point every reference within the
 * load at its new dbId: top-level dbIds, the dbId inside attributes, and references in attributes of the new and
 * updated instances and in the bookmarks. Returns the renumbered copy (the input is not changed) and the map from
 * each new dbId back to the exported one.
 *
 * Why: the annotation service numbers an annotation's new instances itself, from -1 down, so they collide with
 * dbIds this browser has already handed out, and a dbId still cached for a discarded instance (in any open tab)
 * then lends its cached shell, class and all, to the loaded instance. See DataService.getNextNewDbId.
 */
export function renumberNewInstances<T extends { newInstances?: unknown[]; updatedInstances?: unknown[]; bookmarks?: unknown[] }>(
  payload: T, fresh: number[]): { payload: T; stagedToExported: Map<number, number> } {
  const news = (payload.newInstances ?? []) as Exported[];
  const ids = [...new Set(news.map(i => i.dbId).filter(id => id < 0))];
  if (fresh.length < ids.length) throw new Error(`renumberNewInstances: ${ids.length} dbIds needed, ${fresh.length} given`);
  const oldToNew = new Map(ids.map((id, k) => [id, fresh[k]]));
  const stagedToExported = new Map(ids.map((id, k) => [fresh[k], id]));
  const remap = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(remap);
    if (isRef(v) && oldToNew.has(v.dbId)) return { ...v, dbId: oldToNew.get(v.dbId)! };
    return v;
  };
  const renumber = (i: Exported): Exported => {
    const attributes: Record<string, unknown> = {};
    for (const [name, v] of Object.entries(i.attributes ?? {}))
      attributes[name] = name === 'dbId' && typeof v === 'number' && oldToNew.has(v) ? oldToNew.get(v)! : remap(v);
    return { ...i, dbId: oldToNew.get(i.dbId) ?? i.dbId, ...(i.attributes ? { attributes } : {}) };
  };
  return {
    payload: {
      ...payload,
      newInstances: news.map(renumber),
      updatedInstances: ((payload.updatedInstances ?? []) as Exported[]).map(renumber),
      bookmarks: ((payload.bookmarks ?? []) as unknown[]).map(remap),
    },
    stagedToExported,
  };
}
