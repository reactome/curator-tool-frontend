import { of, throwError } from 'rxjs';
import { Evidence, InstanceEvidence } from '../../models/llm-api.models';
import { LlmApiError } from '../../services/llm-api.service';
import { EvidenceDialogComponent } from './evidence-dialog.component';
import { EvidenceListComponent } from '../evidence-list/evidence-list.component';
import { InstanceViewComponent } from 'src/app/instance/components/instance-view/instance-view.component';
import { LOADED_SESSION_KEY } from '../../services/staging';

const ev = (id: string, extra: Partial<Evidence> = {}): Evidence => ({
  id, quote: `q-${id}`, pmid: '1', section: 'Results', page: 3, figure: null, char_span: null, verified: 'exact', match_score: null,
  supports: [], system: null, experimental_species: null, claim_origin: 'this_paper', cited_reference: null, strength: null, ...extra });

describe('EvidenceDialogComponent', () => {
  const data = { sessionId: 's1', dbId: -7, title: 'PINK1 phosphorylates Ub' };

  it('groups quotes by the field they support, in server order, with plain labels', () => {
    const list: InstanceEvidence[] = [
      { field: 'regulatedBy[1]', evidence: ev('a') }, { field: 'catalystActivity', evidence: ev('b') },
      { field: 'regulatedBy[1]', evidence: ev('c') }, { field: 'reaction', evidence: ev('d') }];
    const groups = EvidenceDialogComponent.group(list);
    expect(groups.map(g => g.label)).toEqual(['Regulator 2', 'Catalyst', 'The reaction']);
    expect(groups[0].items.map(e => e.id)).toEqual(['a', 'c']);
  });

  it('loads the evidence for the staged instance id and groups it', () => {
    const api = jasmine.createSpyObj('LlmApiService', ['instanceEvidence']);
    api.instanceEvidence.and.returnValue(of([{ field: 'catalystActivity', evidence: ev('b') }]));
    const d = new EvidenceDialogComponent(data, api);
    d.ngOnInit();
    expect(api.instanceEvidence).toHaveBeenCalledWith('s1', -7);
    expect(d.loading).toBeFalse();
    expect(d.groups.length).toBe(1);
  });

  it('says so when the annotation is gone, and shows other errors as they are', () => {
    const api = jasmine.createSpyObj('LlmApiService', ['instanceEvidence']);
    api.instanceEvidence.and.returnValue(throwError(() => new LlmApiError(404, 'no such session')));
    const d = new EvidenceDialogComponent(data, api);
    d.ngOnInit();
    expect(d.error).toContain('no longer available');
    api.instanceEvidence.and.returnValue(throwError(() => new LlmApiError(0, 'not reachable')));
    const d2 = new EvidenceDialogComponent(data, api);
    d2.ngOnInit();
    expect(d2.error).toBe('not reachable');
  });
});

describe('EvidenceListComponent', () => {
  const list = new EvidenceListComponent();
  it('labels verification honestly, including a close match with its percentage', () => {
    expect(list.verifyLabel(ev('a'))).toBe('verbatim');
    expect(list.verifyLabel(ev('a', { verified: 'fuzzy', match_score: 98.6 }))).toBe('close match');
    expect(list.verifyHint(ev('a', { verified: 'fuzzy', match_score: 98.6 }))).toContain('99%');
    expect(list.verifyLabel(ev('a', { verified: 'unverified' }))).toBe('not checked');
    expect(list.verifyLabel(ev('a', { verified: 'failed' }))).toBe('not found in paper');
  });

  it('words what a quote supports and where a claim comes from', () => {
    expect(list.supportLabel('regulatedBy[0]')).toBe('regulator 1');
    expect(list.supportLabel('catalystActivity')).toBe('catalyst');
    expect(list.supportLabel('compartment')).toBe('compartment');
    expect(list.origin(ev('a'))).toBeNull();
    expect(list.origin(ev('a', { claim_origin: 'cited', cited_reference: 'Kondapalli et al. 2012' }))).toBe('cited from Kondapalli et al. 2012');
    expect(list.origin(ev('a', { claim_origin: 'cited' }))).toBe('cited from earlier work');
    expect(list.origin(ev('a', { claim_origin: 'curator_assertion' }))).toBe('curator assertion');
  });
});

describe('InstanceViewComponent evidence button', () => {
  const has = (instance: any) => (InstanceViewComponent.prototype as any).hasAnnotationEvidence.call({ instance });
  afterEach(() => localStorage.removeItem(LOADED_SESSION_KEY));

  it('shows only for staged new instances of evidence-bearing classes while an annotation is loaded', () => {
    localStorage.setItem(LOADED_SESSION_KEY, 's1');
    expect(has({ dbId: -3, schemaClassName: 'Reaction' })).toBeTrue();
    expect(has({ dbId: -3, schemaClassName: 'CatalystActivity' })).toBeTrue();
    expect(has({ dbId: -3, schemaClassName: 'PositiveRegulation' })).toBeTrue();
    expect(has({ dbId: -3, schemaClassName: 'Summation' })).toBeFalse();               // no quotes attach to it
    expect(has({ dbId: 123, schemaClassName: 'Reaction' })).toBeFalse();                // committed instances have no session id
    expect(has(undefined)).toBeFalse();
  });

  it('is hidden when no annotation has been loaded', () => {
    expect(has({ dbId: -3, schemaClassName: 'Reaction' })).toBeFalse();
  });
});
