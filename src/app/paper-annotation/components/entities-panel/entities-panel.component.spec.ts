import { EntityInfo, Issue, Proposal } from '../../models/llm-api.models';
import { EntitiesPanelComponent } from './entities-panel.component';

describe('EntitiesPanelComponent', () => {
  const entity = (key: string, name: string, o: Partial<EntityInfo['participant']> = {}): EntityInfo =>
    ({ key, participant: { kind: 'ewas', key, name, needs_resolution: [], ...o }, dbId: -3, reactions: [], partOf: [] });
  const issue = (id: string, o: Partial<Issue>): Issue =>
    ({ id, source: 'compartments', severity: 'info', code: 'c', message: id, reaction_key: null, participant_key: null,
       instance_db_id: null, status: 'open', ...o });
  const fix: Proposal = { id: 'p1', reason: '', ops: [], summary: [], reaction_keys: [], evidence: [], actor: 'suggestions',
                          status: 'pending', created: 1, decided_by: null, decided_at: null };
  let panel: EntitiesPanelComponent;

  beforeEach(() => {
    panel = new EntitiesPanelComponent();
    panel.entities = [entity('ub', 'UB', { uniprot: 'P0CG48', compartment_name: 'cytosol', compartment_source: 'stated' }),
                      entity('axl', 'AXL'), entity('atp', 'ATP', { kind: 'simple' })];
    panel.proposals = [fix];
    panel.issues = [issue('n1', { participant_key: 'axl', proposal_id: 'p1' }),          // a note with a fix: counts
                    issue('n2', { participant_key: 'atp' }),                             // a plain note: does not
                    issue('r1', { participant_key: 'ub', reaction_key: 'r0', severity: 'warning' })];  // a reaction's
  });

  it('filters by name, UniProt or compartment, and sorts by name or by what needs attention', () => {
    panel.filter = 'p0cg';
    expect(panel.shown.map(e => e.key)).toEqual(['ub']);
    panel.filter = 'cytosol';
    expect(panel.shown.map(e => e.key)).toEqual(['ub']);
    panel.filter = '';
    panel.sort = 'name';
    expect(panel.shown.map(e => e.key)).toEqual(['atp', 'axl', 'ub']);
    panel.sort = 'attention';
    expect(panel.shown[0].key).toBe('axl');
  });

  it("lists the entity's own issues (not those of a reaction) and counts those worth a look", () => {
    expect(panel.issuesOf('ub')).toEqual([]);
    expect(panel.openCount('axl')).toBe(1);
    expect(panel.openCount('atp')).toBe(0);
  });

  it('shows the first entity until one is chosen, and tells the page which', () => {
    expect(panel.selected?.key).toBe('ub');
    const chosen: string[] = [];
    panel.selectedKeyChange.subscribe(k => chosen.push(k));
    panel.select('atp');
    expect(panel.selected?.key).toBe('atp');
    expect(chosen).toEqual(['atp']);
    expect(panel.kindLabel(panel.selected!.participant)).toBe('small molecule');
  });
});
