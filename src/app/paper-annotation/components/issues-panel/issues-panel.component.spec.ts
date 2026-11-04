import { of, throwError } from 'rxjs';
import { Issue, ReactionQA } from '../../models/llm-api.models';
import { LlmApiError } from '../../services/llm-api.service';
import { IssuesPanelComponent, PER_REACTION } from './issues-panel.component';

describe('IssuesPanelComponent', () => {
  const issue = (id: string, severity: Issue['severity'], extra: Partial<Issue> = {}): Issue =>
    ({ id, source: 'qa', severity, code: 'c', message: `m-${id}`, reaction_key: 'r0', participant_key: null, instance_db_id: null,
       status: 'open', category: 'content', blocked_by: null, proposal_id: null, ...extra });
  const qa = (priority: ReactionQA['priority'], summary = `do ${priority}`): ReactionQA => ({ priority, summary, score: 0.5, is_reaction: true });
  let api: jasmine.SpyObj<any>;
  let panel: IssuesPanelComponent;

  beforeEach(() => {
    api = jasmine.createSpyObj('LlmApiService', ['setIssueStatus', 'qaAll', 'accept', 'reject']);
    panel = new IssuesPanelComponent(api);
    panel.sessionId = 's1';
    panel.reactions = [{ key: 'r0', name: 'WEE1 phosphorylates CDH1', dbId: -1, evidenceIds: [] },
                       { key: 'r1', name: 'CDK1 phosphorylates WEE1', dbId: -2, evidenceIds: [] },
                       { key: 'r2', name: 'cyclin B destruction', dbId: -3, evidenceIds: [] }];
    panel.qa = { r0: qa('review'), r2: qa('fix_first') };
    panel.issues = [
      issue('k1', 'warning', { reaction_key: 'r1', category: 'keep', code: 'qa_methods_only', proposal_id: 'p1' }),
      issue('k2', 'action', { reaction_key: 'r1', category: 'keep', code: 'qa_not_a_reaction' }),
      issue('w1', 'action', { reaction_key: 'r1', blocked_by: 'k1' }),
      issue('a', 'warning', { category: 'evidence' }),
      issue('b', 'action', { category: 'content' }),
      issue('n', 'info', { category: 'existing' }),
      issue('c', 'action', { reaction_key: 'r2', category: 'identifiers' }),
      issue('e', 'warning', { reaction_key: null, category: 'identifiers', message: 'CDK2 (active): no UniProt accession' }),
      issue('d', 'action', { status: 'dismissed' })];
  });

  it('puts the reactions to keep or remove first, with their reasons and the fix that removes them', () => {
    expect(panel.decisions.map(d => [d.key, d.reasons.map(r => r.id), d.proposalId]))
      .toEqual([['r1', ['k1', 'k2'], 'p1']]);
    expect(panel.decisions[0].name).toBe('CDK1 phosphorylates WEE1');
  });

  it('groups the rest by reaction, worst first, entities last, and holds back waiting issues and notes', () => {
    expect(panel.groups.map(g => [g.key, g.issues.map(i => i.id)])).toEqual([
      ['r2', ['c']], ['r0', ['b', 'a']], [null, ['e']]]);                 // fix_first before review; by category in a group
    expect(panel.groups[0].qa?.summary).toBe('do fix_first');
    expect(panel.waiting).toBe(1);
    expect(panel.notes).toBe(1);
    panel.showWaiting = true;
    panel.showNotes = true;
    expect(panel.groups.find(g => g.key === 'r1')?.issues.map(i => i.id)).toEqual(['w1']);
    expect(panel.groups.find(g => g.key === 'r0')?.issues.map(i => i.id)).toEqual(['n', 'b', 'a']);   // existing before content
  });

  it('tells apart two reactions with the same name and decides look-alikes together', () => {
    panel.reactions = [{ key: 'r11', name: 'WEE1 phosphorylates CDK1 at Tyr15', dbId: -1, evidenceIds: [], equation: 'CDK1 + ATP -> CDK1 (catalyst WEE1)' },
                       { key: 'r5', name: 'APC/C degrades cyclin B', dbId: -2, evidenceIds: [] },
                       { key: 'r28', name: 'WEE1 phosphorylates CDK1 at Tyr15', dbId: -3, evidenceIds: [],
                         equation: 'CDK1:Cyclin B -> CDK1(pTyr15):Cyclin B (catalyst WEE1)' }];
    const keep = (id: string, key: string) => issue(id, 'warning', { reaction_key: key, category: 'keep', code: 'qa_methods_only' });
    panel.issues = [keep('k11', 'r11'), keep('k5', 'r5'), issue('k5b', 'action', { reaction_key: 'r5', category: 'keep' }), keep('k28', 'r28'),
                    issue('dup', 'warning', { reaction_key: 'r28', code: 'qa_possible_duplicate', category: 'content',
                                              message: 'may describe the same event as r11 "WEE1 phosphorylates CDK1 at Tyr15"' })];
    const d = panel.decisions;
    expect(d.map(x => x.key)).toEqual(['r5', 'r11', 'r28']);          // r28 right after the reaction it resembles
    expect(d[2].equation).toContain('CDK1:Cyclin B');
    expect(d[2].lookalikes.map(i => i.id)).toEqual(['dup']);
    expect(panel.listed.map(i => i.id)).toEqual([]);                    // shown in the decision, not again below
  });

  it('filters by status', () => {
    panel.status = 'dismissed';
    expect(panel.listed.map(i => i.id)).toEqual(['d']);
  });

  it('shows a few issues per reaction until asked for more', () => {
    panel.issues = Array.from({ length: PER_REACTION + 2 }, (_, n) => issue(`x${n}`, 'warning'));
    const [g] = panel.groups;
    expect(panel.visible(g).length).toBe(PER_REACTION);
    panel.toggle(g);
    expect(panel.visible(g).length).toBe(PER_REACTION + 2);
  });

  it('removes a reaction by accepting the fix, then has the page re-read the session', () => {
    api.accept.and.returnValue(of({}));
    const removed: string[] = [];
    let reloads = 0;
    panel.removed.subscribe(k => removed.push(k));
    panel.checked.subscribe(() => reloads++);
    panel.remove(panel.decisions[0]);
    expect(api.accept).toHaveBeenCalledWith('s1', 'p1');
    expect(removed).toEqual(['r1']);
    expect(reloads).toBe(1);
  });

  it('keeps a reaction by dismissing its reasons and rejecting the removal', () => {
    api.setIssueStatus.and.returnValue(of({}));
    api.reject.and.returnValue(of({}));
    let reloads = 0;
    panel.checked.subscribe(() => reloads++);
    panel.keep(panel.decisions[0]);
    expect(api.setIssueStatus.calls.allArgs()).toEqual([['s1', 'k1', 'dismissed'], ['s1', 'k2', 'dismissed']]);
    expect(api.reject).toHaveBeenCalledWith('s1', 'p1');
    expect(reloads).toBe(1);
  });

  it('shows the reason when a decision fails', () => {
    api.accept.and.returnValue(throwError(() => new LlmApiError(409, 'stale proposal')));
    panel.remove(panel.decisions[0]);
    expect(panel.error).toBe('stale proposal');
    expect(panel.busy.size).toBe(0);
  });

  it('changes an issue status through the API and reports the updated issue', () => {
    const updated = issue('b', 'action', { status: 'resolved' });
    api.setIssueStatus.and.returnValue(of(updated));
    const out: Issue[] = [];
    panel.changed.subscribe(i => out.push(i));
    panel.setStatus(panel.issues[4], 'resolved');
    expect(api.setIssueStatus).toHaveBeenCalledWith('s1', 'b', 'resolved');
    expect(out).toEqual([updated]);
  });

  it('checks all reactions and asks the page to re-read, or shows why it failed', () => {
    api.qaAll.and.returnValue(of([]));
    let reloads = 0;
    panel.checked.subscribe(() => reloads++);
    panel.checkAll();
    expect(reloads).toBe(1);
    api.qaAll.and.returnValue(throwError(() => new LlmApiError(409, 'session is not ready')));
    panel.checkAll();
    expect(panel.error).toBe('session is not ready');
    expect(panel.checking).toBeFalse();
  });

  it('labels and icons', () => {
    expect(panel.categoryLabel(issue('x', 'info', { category: 'keep' }))).toBe('Keep this reaction?');
    expect(panel.priorityLabel('fix_first')).toBe('Fix first');
    expect(['action', 'warning', 'info'].map(s => panel.icon(issue('x', s as Issue['severity'])))).toEqual(['error', 'warning', 'info']);
  });
});
