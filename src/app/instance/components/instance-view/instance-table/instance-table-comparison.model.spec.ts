import { firstValueFrom } from "rxjs";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { AttributeCategory, AttributeDataType, AttributeDefiningType, SchemaAttribute } from "src/app/core/models/reactome-schema.model";
import { InstanceComparisonDataSource } from "./instance-table-comparison.model";

/**
 * Covers the "attributes having different values" filter used when two instances are compared
 * side by side. The filter has to diff value against referenceValue: the two instances are
 * separate database objects, so neither carries edit tracking to filter on.
 */
describe('InstanceComparisonDataSource', () => {

  const attribute = (name: string, type: AttributeDataType = AttributeDataType.STRING): SchemaAttribute => ({
    cardinality: '1',
    name: name,
    origin: 'DatabaseObject',
    category: AttributeCategory.OPTIONAL,
    definingType: AttributeDefiningType.UNDEFINED,
    type: type
  });

  const instance = (dbId: number, className: string, attributes: SchemaAttribute[], values: [string, any][]): Instance => ({
    dbId: dbId,
    schemaClassName: className,
    displayName: className + ' ' + dbId,
    schemaClass: { name: className, attributes: attributes },
    attributes: new Map<string, any>(values)
  });

  // All categories on so nothing is dropped by the category filter
  const allCategories = new Map<AttributeCategory, boolean>();
  for (const category of Object.values(AttributeCategory)) {
    if (typeof category === 'number')
      allCategories.set(category, true);
  }

  const connect = (inst: Instance, refInst: Instance, filterEdited: boolean) =>
    firstValueFrom(new InstanceComparisonDataSource(inst, allCategories, true, false, filterEdited, refInst).connect());

  const atts = [attribute('name'), attribute('definition'), attribute('species', AttributeDataType.INSTANCE)];

  it('keeps the attributes whose values differ', async () => {
    const first = instance(1, 'Pathway', atts, [
      ['name', ['Apoptosis']],
      ['definition', 'shared text'],
      ['species', [{ dbId: 48887, schemaClassName: 'Species' }]]
    ]);
    const second = instance(2, 'Pathway', atts, [
      ['name', ['Autophagy']],
      ['definition', 'shared text'],
      ['species', [{ dbId: 48887, schemaClassName: 'Species' }]]
    ]);

    const filtered = await connect(first, second, true);

    expect(filtered.map(att => att.attribute.name)).toEqual(['name']);
    // The differing values themselves must reach the table, one per column
    expect(filtered[0].value).toEqual(['Apoptosis']);
    expect(filtered[0].referenceValue).toEqual(['Autophagy']);
  });

  it('keeps an attribute set on only one of the two instances', async () => {
    const first = instance(1, 'Pathway', atts, [['name', ['Apoptosis']], ['definition', 'only here']]);
    const second = instance(2, 'Pathway', atts, [['name', ['Apoptosis']]]);

    const filtered = await connect(first, second, true);

    expect(filtered.map(att => att.attribute.name)).toEqual(['definition']);
  });

  it('detects a differing instance value, and one missing opposite a database instance', async () => {
    const species = [{ dbId: 48887, schemaClassName: 'Species' }];
    const first = instance(1, 'Pathway', atts, [['species', species]]);
    const second = instance(2, 'Pathway', atts, [['species', [{ dbId: 49633, schemaClassName: 'Species' }]]]);
    expect((await connect(first, second, true)).map(att => att.attribute.name)).toEqual(['species']);

    // Same slot length, but the second instance's single value is absent
    const withHole = instance(3, 'Pathway', atts, [['species', [undefined]]]);
    expect((await connect(first, withHole, true)).map(att => att.attribute.name)).toEqual(['species']);
  });

  it('returns nothing to show when the two instances agree', async () => {
    const first = instance(1, 'Pathway', atts, [['name', ['Apoptosis']]]);
    const second = instance(2, 'Pathway', atts, [['name', ['Apoptosis']]]);

    expect(await connect(first, second, true)).toEqual([]);
  });

  it('unions the attributes of both schema classes, and sorts the filtered rows', async () => {
    // 'compartment' is defined by the second instance's class only; the filter must still
    // consider it, and the surviving rows must come back sorted like the unfiltered ones
    const secondAtts = [...atts, attribute('compartment', AttributeDataType.INSTANCE)];
    const first = instance(1, 'Pathway', atts, [['definition', 'first']]);
    const second = instance(2, 'Reaction', secondAtts, [['compartment', [{ dbId: 876, schemaClassName: 'Compartment' }]]]);

    const filtered = await connect(first, second, true);

    expect(filtered.map(att => att.attribute.name)).toEqual(['compartment', 'definition']);
  });

  it('shows every attribute of both classes when the filter is off', async () => {
    const secondAtts = [...atts, attribute('compartment', AttributeDataType.INSTANCE)];
    const first = instance(1, 'Pathway', atts, [['name', ['Apoptosis']]]);
    const second = instance(2, 'Reaction', secondAtts, [['name', ['Apoptosis']]]);

    const unfiltered = await connect(first, second, false);

    expect(unfiltered.map(att => att.attribute.name)).toEqual(['compartment', 'definition', 'name', 'species']);
  });

});
