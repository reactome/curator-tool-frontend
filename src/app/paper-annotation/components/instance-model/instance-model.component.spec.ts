import { InstanceModelComponent, StagedInstance } from './instance-model.component';

describe('InstanceModelComponent', () => {
  const ref = (dbId: number, displayName: string, schemaClassName: string) => ({ dbId, displayName, schemaClassName });
  const instances: Record<number, StagedInstance> = {
    [-1]: { dbId: -1, displayName: 'PINK1 phosphorylates Ub', schemaClassName: 'Reaction', attributes: {
      dbId: -1, displayName: 'PINK1 phosphorylates Ub', name: ['PINK1 phosphorylates Ub'],
      input: [ref(-3, 'UB [cytosol]', 'EntityWithAccessionedSequence'), ref(113592, 'ATP [cytosol]', 'SimpleEntity')],
      regulatedBy: [ref(-2, 'Requirement by PINK1', 'Requirement')], literatureReference: [] } },
    [-2]: { dbId: -2, displayName: 'Requirement by PINK1', schemaClassName: 'Requirement', attributes: {
      regulatedEntity: [ref(-1, 'PINK1 phosphorylates Ub', 'Reaction')] } },
    [-3]: { dbId: -3, displayName: 'UB [cytosol]', schemaClassName: 'EntityWithAccessionedSequence', attributes: {} },
  };
  const model = (dbId: number | null, path: number[] = []) => {
    const m = new InstanceModelComponent();
    m.dbId = dbId;
    m.instances = instances;
    m.path = path;
    m.ngOnChanges();
    return m;
  };

  it('lists the attributes as exported, without dbId, displayName or empty ones', () => {
    const m = model(-1);
    expect(m.rows.map(r => r.name)).toEqual(['name', 'input', 'regulatedBy']);
    expect(m.rows[0].values).toEqual(['PINK1 phosphorylates Ub']);
  });

  it('opens a new instance inline, links an existing one, and does not repeat one open above', () => {
    const m = model(-1);
    const [ub, atp] = m.rows[1].values as any[];
    expect(m.isNew(ub)).toBeTrue();
    expect(m.isNew(atp)).toBeFalse();                       // an existing Reactome instance: a schema-view link
    m.toggle(ub);
    expect(m.open.has(-3)).toBeTrue();
    const requirement = model(-2, m.below);
    const back = requirement.rows[0].values[0] as any;
    expect(requirement.isAbove(back)).toBeTrue();           // Requirement -> regulatedEntity -> the reaction above
  });

  it('keeps the same rows between checks, so the table is not rebuilt on every mouse move', () => {
    const m = model(-1);
    const rows = m.rows;
    expect(m.rows).toBe(rows);
    expect(m.trackRow(0, rows[1])).toBe('input');
    expect(m.trackValue(0, rows[1].values[0])).toBe(-3);
  });

  it('knows an existing instance and one that is not exported', () => {
    expect(model(5205653).instance).toBeUndefined();
    expect(model(null).rows).toEqual([]);
  });
});
