import { Instance, NEW_DISPLAY_NAME } from '../models/reactome-instance.model';
import { DataService } from '../services/data.service';
import { InstanceUtilities } from '../services/instance.service';
import { InstanceNameGenerator } from './InstanceNameGenerator';

/**
 * The display name of a Deleted instance, which records the removal of one or more instances from
 * the database. The wording is pinned to what is already there: of the 8040 Deleted instances in
 * the curation database, every one with a single deleted dbId is named "Deletion of instance:
 * <dbId>" and every one with several is named "Deletion of instances: <dbId>, ..." - plural, with
 * no exceptions in either direction. Nothing else generates this name: the back-end's
 * deleteByDeleted generates the names of the DeletedInstance objects it creates, but persists the
 * Deleted instance's own name exactly as the front end sends it.
 */
describe('InstanceNameGenerator, Deleted instance', () => {
  let generator: InstanceNameGenerator;

  beforeEach(() => {
    const dataService = jasmine.createSpyObj<DataService>('DataService', ['getSchemaClass']);
    const utils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities',
      ['isSchemaClass', 'addToModifiedAttributes', 'registerDisplayNameChange']);
    // The generator walks a long list of classes before reaching Deleted.
    utils.isSchemaClass.and.callFake((_instance: Instance, className: string) => className === 'Deleted');

    generator = new InstanceNameGenerator(dataService, utils);
  });

  function deleted(deletedInstanceDbId?: any): Instance {
    const attributes = new Map<string, any>();
    if (deletedInstanceDbId !== undefined)
      attributes.set('deletedInstanceDbId', deletedInstanceDbId);
    return { dbId: -1, displayName: NEW_DISPLAY_NAME, schemaClassName: 'Deleted', attributes };
  }

  it('names a single deletion in the singular', () => {
    expect(generator.generateDisplayName(deleted([1227784]))).toBe('Deletion of instance: 1227784');
  });

  it('names a deletion of several instances in the plural', () => {
    // "instances", and comma-separated in the order the ids are held - the creation dialog sorts
    // them ascending.
    expect(generator.generateDisplayName(deleted([75761, 8852186])))
      .toBe('Deletion of instances: 75761, 8852186');
    expect(generator.generateDisplayName(deleted([351685, 351686, 351687, 351689])))
      .toBe('Deletion of instances: 351685, 351686, 351687, 351689');
  });

  it('says unknown when the deletion records no dbId', () => {
    expect(generator.generateDisplayName(deleted())).toBe('Deletion of instance: unknown');
    expect(generator.generateDisplayName(deleted([]))).toBe('Deletion of instance: unknown');
    expect(generator.generateDisplayName(deleted(null))).toBe('Deletion of instance: unknown');
  });

  it('names a deletion whose dbId is held as a single value rather than a list', () => {
    // deletedInstanceDbId is multi-valued in the schema, so it is normally an array. A lone value
    // must still be named after what it deletes rather than reported as unknown.
    expect(generator.generateDisplayName(deleted(1227784))).toBe('Deletion of instance: 1227784');
  });

  it('replaces the placeholder name a new Deleted instance is created with', () => {
    const instance = deleted([1227784]);

    generator.updateDisplayName(instance);

    expect(instance.displayName).toBe('Deletion of instance: 1227784');
    expect(instance.attributes.get('displayName')).toBe('Deletion of instance: 1227784');
  });
});
