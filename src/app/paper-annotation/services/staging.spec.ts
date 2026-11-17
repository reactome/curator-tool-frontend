import { SessionUserInstances } from '../models/llm-api.models';
import { PINK1_EXPORT } from '../testing/pink1-export.fixture';
import { exportedDbIdOf, LOADED_DB_IDS_KEY, renumberNewInstances, selectReactions } from './staging';

/** Loading only the reactions a curator checked, cut out of a real export (Kane et al. 2014, PINK1). */
describe('selectReactions', () => {
  type Raw = { dbId: number; displayName: string; schemaClassName: string; attributes?: Record<string, any> };
  const exported = (): SessionUserInstances => JSON.parse(JSON.stringify(PINK1_EXPORT));
  const raw = (e: SessionUserInstances) => e.newInstances as unknown as Raw[];
  const refs = (i: Raw): { dbId: number; schemaClassName: string }[] =>
    Object.values(i.attributes ?? {}).flatMap(v => (Array.isArray(v) ? v : [v])).filter(x => x && typeof x === 'object' && typeof x.dbId === 'number');
  const reactions = raw(exported()).filter(i => i.schemaClassName === 'Reaction' || i.schemaClassName === 'BlackBoxEvent');
  const ids = (e: SessionUserInstances) => new Set(raw(e).map(i => i.dbId));

  /** The first reaction with a catalyst, and one sharing no entity with it, if the paper has one. */
  const withCatalyst = reactions.find(r => !!r.attributes?.['catalystActivity'])!;

  it('loads nothing when no reaction is checked', () => {
    expect(selectReactions(exported(), []).newInstances).toEqual([]);
  });

  it('loads a checked reaction with everything it needs and is self-contained', () => {
    const picked = selectReactions(exported(), [withCatalyst.dbId]);
    const kept = ids(picked);
    expect(kept.has(withCatalyst.dbId)).toBeTrue();
    const catalyst = withCatalyst.attributes!['catalystActivity'][0].dbId;
    expect(kept.has(catalyst)).withContext('its catalyst activity').toBeTrue();
    const enzyme = raw(exported()).find(i => i.dbId === catalyst)!.attributes!['physicalEntity'].dbId;
    expect(kept.has(enzyme)).withContext('the catalyst itself').toBeTrue();
    for (const i of raw(picked)) {
      for (const r of refs(i)) {
        if (r.dbId < 0) expect(kept.has(r.dbId)).withContext(`${i.displayName} -> ${r.dbId}`).toBeTrue();
      }
    }
  });

  it('leaves out the reactions that were not checked, and never the pathway', () => {
    const picked = selectReactions(exported(), [withCatalyst.dbId]);
    const classes = raw(picked).map(i => i.schemaClassName);
    expect(classes.filter(c => c === 'Reaction' || c === 'BlackBoxEvent').length).toBe(1);
    expect(classes).not.toContain('Pathway');
  });

  it('keeps the regulations of a checked reaction, which point back at it', () => {
    const regulated = reactions.find(r => raw(exported()).some(i => /Regulation|Requirement/.test(i.schemaClassName) && refs(i).some(x => x.dbId === r.dbId)))!;
    const picked = raw(selectReactions(exported(), [regulated.dbId]));
    const regulations = picked.filter(i => /Regulation|Requirement/.test(i.schemaClassName));
    expect(regulations.length).toBeGreaterThan(0);
    regulations.forEach(g => expect(refs(g).some(x => x.dbId === regulated.dbId)).toBeTrue());
  });

  it('loads an entity two checked reactions share only once', () => {
    const picked = raw(selectReactions(exported(), reactions.map(r => r.dbId)));
    expect(new Set(picked.map(i => i.dbId)).size).toBe(picked.length);
  });

  it('with every reaction checked and the pathway asked for, loads the whole export unchanged', () => {
    const full = exported();
    const picked = selectReactions(full, reactions.map(r => r.dbId), true);
    expect(picked.newInstances).toEqual(full.newInstances);
  });

  it('loads the pathway only when asked for, with hasEvent cut down to the loaded reactions', () => {
    const [a] = reactions;
    expect(raw(selectReactions(exported(), [a.dbId])).some(i => i.schemaClassName === 'Pathway')).toBeFalse();
    const pathway = raw(selectReactions(exported(), [a.dbId], true)).find(i => i.schemaClassName === 'Pathway')!;
    expect(pathway.attributes!['hasEvent'].map((e: any) => e.dbId)).toEqual([a.dbId]);
  });

  it('does not load the pathway alone when no reaction is checked', () => {
    expect(selectReactions(exported(), [], true).newInstances).toEqual([]);
  });

  it('with every reaction checked but the pathway not asked for, loads everything but the pathway', () => {
    const full = exported();
    const picked = selectReactions(full, reactions.map(r => r.dbId));
    const expected = raw(full).filter(i => i.schemaClassName !== 'Pathway').map(i => i.dbId).sort();
    expect([...ids(picked)].sort()).toEqual(expected);
  });

  it('drops a reference to a reaction that was not checked, such as a preceding event', () => {
    const full = exported();
    const [a, b] = reactions;
    const first = raw(full).find(i => i.dbId === a.dbId)!;
    first.attributes = { ...first.attributes, precedingEvent: [{ dbId: b.dbId, displayName: b.displayName, schemaClassName: b.schemaClassName }] };
    const picked = raw(selectReactions(full, [a.dbId]));
    expect(picked.some(i => i.dbId === b.dbId)).toBeFalse();
    expect(picked.find(i => i.dbId === a.dbId)!.attributes!['precedingEvent']).toBeUndefined();
  });

  it('keeps references to existing Reactome instances, such as compartments', () => {
    const picked = raw(selectReactions(exported(), [withCatalyst.dbId]));
    expect(picked.flatMap(refs).some(r => r.dbId > 0)).toBeTrue();
  });

  it('does not change the export it was given', () => {
    const full = exported();
    const before = JSON.stringify(full);
    selectReactions(full, [withCatalyst.dbId]);
    expect(JSON.stringify(full)).toBe(before);
  });

  it('ignores a dbId that is not in the export', () => {
    expect(selectReactions(exported(), [-99999]).newInstances).toEqual([]);
  });
});

describe('renumberNewInstances', () => {
  const exported = (): SessionUserInstances => JSON.parse(JSON.stringify(PINK1_EXPORT));
  type Raw = { dbId: number; schemaClassName: string; attributes?: Record<string, any> };
  const refs = (i: Raw): { dbId: number }[] =>
    Object.entries(i.attributes ?? {}).filter(([k]) => k !== 'dbId').flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
      .filter(x => x && typeof x === 'object' && typeof x.dbId === 'number');

  it('gives every new instance a fresh dbId and keeps the load self-contained', () => {
    const e = exported();
    const news = e.newInstances as unknown as Raw[];
    const fresh = news.map((_, k) => -1000 - k);
    const { payload, stagedToExported } = renumberNewInstances(e, fresh);
    const out = payload.newInstances as unknown as Raw[];
    const ids = new Set(out.map(i => i.dbId));
    expect([...ids].sort()).toEqual([...fresh].sort());
    for (const i of out) {
      if (i.attributes?.['dbId'] !== undefined) expect(i.attributes['dbId']).withContext('attributes.dbId').toBe(i.dbId);
      for (const r of refs(i)) {
        if (r.dbId < 0) expect(ids.has(r.dbId)).withContext(`a reference to ${r.dbId}`).toBeTrue();
      }
    }
    // each staged dbId maps back to the exported one, which the service finds evidence by
    news.forEach((i, k) => expect(stagedToExported.get(fresh[k])).toBe(i.dbId));
    expect(e).toEqual(exported());                                         // the export is not changed
  });

  it('refuses to run short of dbIds', () => {
    expect(() => renumberNewInstances(exported(), [-1])).toThrowError(/dbIds needed/);
  });
});

describe('exportedDbIdOf', () => {
  afterEach(() => localStorage.removeItem(LOADED_DB_IDS_KEY));

  it('finds the exported dbId of a renumbered instance, and falls back to the staged one', () => {
    localStorage.setItem(LOADED_DB_IDS_KEY, JSON.stringify({ '-41': -1, '-42': -2 }));
    expect(exportedDbIdOf(-42)).toBe(-2);
    expect(exportedDbIdOf(-7)).toBe(-7);                                   // not from the last load
    localStorage.setItem(LOADED_DB_IDS_KEY, 'not json');
    expect(exportedDbIdOf(-42)).toBe(-42);
  });
});
