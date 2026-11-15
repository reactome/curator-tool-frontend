import { SimpleChange } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { LlmApiError } from '../../services/llm-api.service';
import { QAResult, ReactionDetail, Issue, Proposal } from '../../models/llm-api.models';
import { ReactionDetailComponent } from './reaction-detail.component';

describe('ReactionDetailComponent QA review', () => {
  let api: jasmine.SpyObj<any>;
  let panel: ReactionDetailComponent;

  beforeEach(() => {
    api = jasmine.createSpyObj('LlmApiService', ['reaction', 'qa']);
    panel = new ReactionDetailComponent(api);
    panel.sessionId = 's1';
    panel.reactionKey = 'r3';
  });

  it('shows nothing before any check', () => {
    expect(panel.qaView).toBeNull();
  });

  it('shows the review saved with the session, including "not a reaction"', () => {
    panel.savedQa = { priority: 'fix_first', summary: 'a structural contact inside a complex', score: 0.2, is_reaction: false };
    const v = panel.qaView!;
    expect(panel.qaLabel(v)).toBe('Fix first');
    expect(v.isReaction).toBeFalse();
    expect(v.summary).toContain('structural contact');
    expect(v.llmUsed).toBeTrue();
  });

  it('a check run here replaces the saved review and tells the page to re-read the session', () => {
    panel.savedQa = { priority: 'review', summary: 'old', score: 0.7, is_reaction: true };
    const fresh: QAResult = { reaction_key: 'r3', reaction_name: 'x', verdict: 'needs_work', priority: 'fix', summary: 'new',
                              score: 0.5, findings: [], llm_used: true };
    api.qa.and.returnValue(of(fresh));
    let reloads = 0;
    panel.changed.subscribe(() => reloads++);
    panel.runQa();
    expect(api.qa).toHaveBeenCalledWith('s1', 'r3');
    expect(panel.qaView?.summary).toBe('new');
    expect(panel.qaLabel(panel.qaView!)).toBe('Needs fixing');
    expect(reloads).toBe(1);
  });
});

describe('ReactionDetailComponent refresh', () => {
  let api: jasmine.SpyObj<any>;
  let panel: ReactionDetailComponent;
  const version = (dbId: number): ReactionDetail => ({ reaction: {} as ReactionDetail['reaction'], dbId, participants: {}, evidence: [] });

  beforeEach(() => {
    api = jasmine.createSpyObj('LlmApiService', ['reaction', 'qa']);
    panel = new ReactionDetailComponent(api);
    panel.sessionId = 's1';
    panel.reactionKey = 'r3';
  });

  it('re-reads the open reaction when the draft changes (an accepted chat edit), keeping a QA result run here', () => {
    api.reaction.and.returnValue(of(version(1)));
    panel.ngOnChanges({ reactionKey: new SimpleChange(undefined, 'r3', true) });
    expect(panel.detail?.dbId).toBe(1);
    panel.qa = { reaction_key: 'r3', reaction_name: 'x', verdict: 'ok', priority: 'fix', summary: 'fine', score: 1,
                 findings: [], llm_used: true };

    const next = new Subject<ReactionDetail>();
    api.reaction.and.returnValue(next);
    panel.stamp = 1;
    panel.ngOnChanges({ stamp: new SimpleChange(0, 1, false) });
    expect(api.reaction).toHaveBeenCalledTimes(2);
    expect(panel.detail?.dbId).toBe(1);          // still shown while the new version loads
    next.next(version(2));
    expect(panel.detail?.dbId).toBe(2);
    expect(panel.qa?.summary).toBe('fine');
  });

  it('ignores a slow answer for the previous reaction once another one is selected', () => {
    const slow = new Subject<ReactionDetail>();
    api.reaction.and.returnValue(slow);
    panel.ngOnChanges({ reactionKey: new SimpleChange(undefined, 'r3', true) });
    api.reaction.and.returnValue(of(version(4)));
    panel.reactionKey = 'r4';
    panel.ngOnChanges({ reactionKey: new SimpleChange('r3', 'r4', false) });
    slow.next(version(3));
    expect(panel.detail?.dbId).toBe(4);
  });
});

describe('ReactionDetailComponent remove', () => {
  let api: jasmine.SpyObj<any>;
  let panel: ReactionDetailComponent;

  beforeEach(() => {
    api = jasmine.createSpyObj('LlmApiService', ['reaction', 'qa', 'removeReaction']);
    panel = new ReactionDetailComponent(api);
    panel.sessionId = 's1';
    panel.reactionKey = 'r3';
  });

  it('removes the reaction once confirmed and tells the page which one', () => {
    api.removeReaction.and.returnValue(of({}));
    const removed: string[] = [];
    panel.removed.subscribe(k => removed.push(k));
    panel.confirmRemove = true;
    panel.remove();
    expect(api.removeReaction).toHaveBeenCalledWith('s1', 'r3');
    expect(removed).toEqual(['r3']);
    expect(panel.confirmRemove).toBeFalse();
    expect(panel.removing).toBeFalse();
  });

  it('shows why when the service refuses, and removes nothing', () => {
    api.removeReaction.and.returnValue(throwError(() => new LlmApiError(404, "no reaction with key 'r3'")));
    const removed: string[] = [];
    panel.removed.subscribe(k => removed.push(k));
    panel.remove();
    expect(panel.error).toContain('no reaction');
    expect(removed).toEqual([]);
  });

  it('forgets an open confirmation when another reaction is selected', () => {
    api.reaction.and.returnValue(new Subject());
    panel.confirmRemove = true;
    panel.reactionKey = 'r4';
    panel.ngOnChanges({ reactionKey: new SimpleChange('r3', 'r4', false) });
    expect(panel.confirmRemove).toBeFalse();
  });
});

describe('ReactionDetailComponent compartments', () => {
  const panel = new ReactionDetailComponent(jasmine.createSpyObj('LlmApiService', ['reaction']));
  const base = { kind: 'ewas' as const, key: 'k', name: 'CTNNB1', needs_resolution: [] };

  it('shows where the paper places a participant, with its quote', () => {
    const c = panel.compartment({ ...base, compartment_name: 'nucleoplasm', compartment_source: 'stated',
                                  compartment_quote: 'translocates to the nucleus' });
    expect(c.label).toBe('nucleoplasm');
    expect(c.cls).toBe('stated');
    expect(c.tip).toContain('“translocates to the nucleus”');
    expect(panel.compartment({ ...base, compartment_name: 'cytosol', compartment_source: 'shown' }).tip).toContain('experiment');
  });

  it('shows "no compartment" without evidence, naming the suggestion but not applying it', () => {
    const c = panel.compartment({ ...base, compartment_suggested: { db_id: 876, display_name: 'plasma membrane', schema_class: 'Compartment' } });
    expect(c.label).toBe('no compartment');
    expect(c.tip).toContain('general knowledge: plasma membrane');
  });
});

describe('ReactionDetailComponent issues, fixes and the keep question', () => {
  const issue = (id: string, o: Partial<Issue>): Issue =>
    ({ id, source: 'checks', severity: 'warning', code: 'c', message: id, reaction_key: 'r3', participant_key: null,
       instance_db_id: null, status: 'open', ...o });
  const fix = (id: string, keys: string[]): Proposal =>
    ({ id, reason: '', ops: [], summary: [], reaction_keys: keys, evidence: [], actor: 'suggestions', status: 'pending',
       created: 1, decided_by: null, decided_at: null });
  let api: jasmine.SpyObj<any>;
  let panel: ReactionDetailComponent;

  beforeEach(() => {
    api = jasmine.createSpyObj('LlmApiService', ['reaction', 'setIssueStatus', 'reject', 'removeReaction']);
    panel = new ReactionDetailComponent(api);
    panel.sessionId = 's1';
    panel.reactionKey = 'r3';
    panel.detail = { reaction: {} as any, dbId: -1, evidence: [], participants: {
      cx: { kind: 'complex', key: 'cx', name: 'A:B', needs_resolution: [], components: ['a', 'b'] },
      a: { kind: 'ewas', key: 'a', name: 'A', needs_resolution: [] } } };
    panel.issues = [issue('k1', { category: 'keep', proposal_id: 'rm' }), issue('w1', { blocked_by: 'k1' }),
                    issue('dup', { code: 'qa_possible_duplicate' }),
                    issue('e1', { reaction_key: null, participant_key: 'b', severity: 'info', proposal_id: 'comp' }),
                    issue('e2', { reaction_key: null, participant_key: 'zzz' })];
    panel.proposals = [fix('rm', ['r3']), fix('comp', ['r3']), fix('loose', ['r3']), fix('elsewhere', ['r9'])];
  });

  it('asks whether to keep it, with its look-alikes; lists its issues and those of its entities (parts too)', () => {
    expect(panel.keepReasons.map(i => i.id)).toEqual(['k1']);
    expect(panel.lookalikes.map(i => i.id)).toEqual(['dup']);
    expect(panel.removalProposal?.id).toBe('rm');
    expect(panel.myIssues.map(i => i.id)).toEqual(['k1', 'w1', 'dup']);
    expect(panel.entityIssues.map(i => i.id)).toEqual(['e1']);               // b is a component of cx
  });

  it('lists its entities with their role, the parts of a complex after it, each once', () => {
    panel.detail = { ...panel.detail!, reaction: { inputs: ['cx', 'a'], outputs: [], catalyst: null, regulations: [] } as any };
    expect(panel.entities.map(e => [e.role, e.p.key])).toEqual([['input', 'cx'], ['input', 'a']]);
    panel.detail = { ...panel.detail!, participants: { ...panel.detail!.participants,      // as a re-read gives it
                                                       b: { kind: 'ewas', key: 'b', name: 'B', needs_resolution: [] } } };
    expect(panel.entities.map(e => [e.role, e.p.key])).toEqual([['input', 'cx'], ['input', 'a'], ['part of A:B', 'b']]);
    expect(panel.issuesOfEntity('b').map(i => i.id)).toEqual(['e1']);
  });

  it('gives the same entity rows and entity issues between checks (no rebuild on every mouse move)', () => {
    panel.detail = { ...panel.detail!, reaction: { inputs: ['cx', 'a'], outputs: [], catalyst: null, regulations: [] } as any };
    expect(panel.entities).toBe(panel.entities);
    expect(panel.issuesOfEntity('b')).toBe(panel.issuesOfEntity('b'));
    expect(panel.issuesOfEntity('nobody')).toBe(panel.issuesOfEntity('none'));
    const before = panel.entities;
    panel.detail = { ...panel.detail };                         // the reaction re-read: computed again
    expect(panel.entities).not.toBe(before);
  });

  it('offers the suggested fixes no issue links to', () => {
    expect(panel.otherFixes.map(p => p.id)).toEqual(['loose']);
  });

  it('keeps it: dismisses the reasons and rejects the suggested removal, then asks for a re-read', () => {
    api.setIssueStatus.and.returnValue(of({}));
    api.reject.and.returnValue(of({}));
    let changes = 0;
    panel.changed.subscribe(() => changes++);
    panel.keep();
    expect(api.setIssueStatus).toHaveBeenCalledWith('s1', 'k1', 'dismissed');
    expect(api.reject).toHaveBeenCalledWith('s1', 'rm');
    expect(changes).toBe(1);
  });

  it('removes it from the keep question like the Remove button', () => {
    api.removeReaction.and.returnValue(of({}));
    const removed: string[] = [];
    panel.removed.subscribe(k => removed.push(k));
    panel.removeFromDecision();
    expect(api.removeReaction).toHaveBeenCalledWith('s1', 'r3');
    expect(removed).toEqual(['r3']);
  });
});
