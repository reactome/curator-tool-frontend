import { Instance, MAX_STAGED_INSTANCES } from 'src/app/core/models/reactome-instance.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { PINK1_EXPORT } from '../testing/pink1-export.fixture';

/**
 * The service emits instances the frontend never created. These run a real export through the same functions
 * staging uses (handleInstanceAttributes when it is loaded, cloneInstanceForCommit when it is persisted or
 * backed up), so a format mismatch shows up here and not in a curator's browser.
 */
describe('a real annotation export in the frontend', () => {
  let utils: InstanceUtilities;
  let instances: Instance[];

  beforeEach(() => {
    utils = new InstanceUtilities({} as any, {} as any, {} as any, {} as any);
    instances = JSON.parse(JSON.stringify(PINK1_EXPORT.newInstances));      // fresh copy: handling mutates
    instances.forEach(i => utils.handleInstanceAttributes(i));
  });

  const refsOf = (i: Instance): Instance[] => {
    const out: Instance[] = [];
    (i.attributes as Map<string, any>)?.forEach(v => (Array.isArray(v) ? v : [v]).forEach(x => { if (utils.isInstance(x)) out.push(x); }));
    return out;
  };

  it('is a set the tool can hold: only new instances, all with dbIds below zero, within the staging limit', () => {
    expect(PINK1_EXPORT.updatedInstances).toEqual([]);
    expect(PINK1_EXPORT.deletedInstances).toEqual([]);
    expect(instances.length).toBeGreaterThan(50);
    expect(instances.length).toBeLessThanOrEqual(MAX_STAGED_INSTANCES);
    expect(instances.every(i => i.dbId < 0)).toBeTrue();
    expect(new Set(instances.map(i => i.dbId)).size).toBe(instances.length);
  });

  it('converts every instance to the Map form with each reference becoming a shell', () => {
    for (const i of instances) {
      expect(i.attributes instanceof Map).withContext(`${i.schemaClassName} ${i.displayName}`).toBeTrue();
      for (const ref of refsOf(i)) {
        expect(ref.dbId).withContext(`reference in ${i.displayName}`).toBeDefined();
        expect(ref.schemaClassName).toBeTruthy();
        expect(ref.attributes).withContext('a reference is a shell, not a full instance').toBeUndefined();
      }
    }
  });

  it('is self-contained: every new instance a reference points at is part of the export', () => {
    const ids = new Set(instances.map(i => i.dbId));
    const dangling = instances.flatMap(i => refsOf(i).filter(r => r.dbId < 0 && !ids.has(r.dbId)).map(r => `${i.displayName} -> ${r.dbId}`));
    expect(dangling).toEqual([]);
  });

  it('keeps references to existing Reactome instances as positive-id shells', () => {
    const existing = instances.flatMap(refsOf).filter(r => r.dbId > 0);
    expect(existing.length).toBeGreaterThan(0);                                  // compartments, species, references
    expect(existing.every(r => !!r.displayName && !!r.schemaClassName)).toBeTrue();
  });

  it('survives the persist/backup clone with every attribute intact', () => {
    for (const i of instances) {
      const clone = utils.cloneInstanceForCommit(i);
      const names = Object.keys(clone.attributes ?? {}).sort();
      expect(names).withContext(`${i.schemaClassName} ${i.displayName}`).toEqual([...(i.attributes as Map<string, any>).keys()].sort());
      expect(JSON.parse(JSON.stringify(clone)).dbId).toBe(i.dbId);               // and is plain JSON, as persist needs
    }
  });

  it('has a reaction with its catalyst, regulation and summation wired by reference', () => {
    const reaction = instances.find(i => i.schemaClassName === 'Reaction' && (i.attributes as Map<string, any>).has('catalystActivity'))!;
    const attrs = reaction.attributes as Map<string, any>;
    expect(attrs.get('input').length).toBeGreaterThan(0);
    expect(attrs.get('catalystActivity')[0].schemaClassName).toBe('CatalystActivity');
    const catalyst = instances.find(i => i.dbId === attrs.get('catalystActivity')[0].dbId)!;
    expect((catalyst.attributes as Map<string, any>).get('physicalEntity').schemaClassName).toBe('EntityWithAccessionedSequence');
  });
});
