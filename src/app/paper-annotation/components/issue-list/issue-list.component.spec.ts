import { of, throwError } from 'rxjs';
import { Issue, Proposal } from '../../models/llm-api.models';
import { LlmApiError } from '../../services/llm-api.service';
import { IssueListComponent } from './issue-list.component';

describe('IssueListComponent', () => {
  const issue = (id: string, o: Partial<Issue> = {}): Issue =>
    ({ id, source: 'qa', severity: 'warning', code: 'c', message: id, reaction_key: 'r0', participant_key: null,
       instance_db_id: null, status: 'open', category: 'content', ...o });
  const fix = (id: string, status: Proposal['status'] = 'pending'): Proposal =>
    ({ id, reason: 'r', ops: [], summary: [], reaction_keys: ['r0'], evidence: [], actor: 'suggestions', status,
       created: 1, decided_by: null, decided_at: null });
  let api: jasmine.SpyObj<any>;
  let list: IssueListComponent;

  beforeEach(() => {
    api = jasmine.createSpyObj('LlmApiService', ['setIssueStatus']);
    list = new IssueListComponent(api);
    list.sessionId = 's1';
  });

  it('lists open issues, holds back notes and settled ones until asked, and never the keep question', () => {
    list.issues = [issue('a'), issue('note', { severity: 'info' }), issue('done', { status: 'resolved' }),
                   issue('keep', { category: 'keep' })];
    expect(list.listed.map(i => i.id)).toEqual(['a']);
    expect(list.notes).toBe(1);
    expect(list.done).toBe(1);
    list.showNotes = true;
    list.showDone = true;
    expect(list.listed.map(i => i.id)).toEqual(['a', 'note', 'done']);
  });

  it('shows the fix an issue links to, and a note that comes with a fix is not held back', () => {
    list.proposals = [fix('p1'), fix('p2', 'rejected')];
    list.issues = [issue('comp', { severity: 'info', proposal_id: 'p1', participant_key: 'axl', reaction_key: null }),
                   issue('old', { proposal_id: 'p2' })];
    expect(list.listed.map(i => i.id)).toEqual(['comp', 'old']);                // the one with a fix first
    expect(list.fixOf(list.listed[0])?.id).toBe('p1');
    expect(list.fixOf(list.listed[1])).toBeUndefined();                         // decided already: not offered
  });

  it('lists issues waiting on a keep decision after the others (dimmed in the page)', () => {
    list.issues = [issue('waits', { blocked_by: 'k1', severity: 'action' }), issue('now')];
    expect(list.listed.map(i => i.id)).toEqual(['now', 'waits']);
  });

  it('resolves, dismisses or reopens, then tells the page to re-read; shows why when it fails', () => {
    let changes = 0;
    list.changed.subscribe(() => changes++);
    api.setIssueStatus.and.returnValue(of(issue('a', { status: 'resolved' })));
    list.setStatus(issue('a'), 'resolved');
    expect(api.setIssueStatus).toHaveBeenCalledWith('s1', 'a', 'resolved');
    expect(changes).toBe(1);
    api.setIssueStatus.and.returnValue(throwError(() => new LlmApiError(500, 'down')));
    list.setStatus(issue('a'), 'dismissed');
    expect(changes).toBe(1);
    expect(list.error).toContain('down');
  });

  it('passes a decided fix on and asks for a re-read', () => {
    const got: Proposal[] = [];
    let changes = 0;
    list.proposalDecided.subscribe(p => got.push(p));
    list.changed.subscribe(() => changes++);
    list.onDecided(fix('p1', 'accepted'));
    expect(got.map(p => p.id)).toEqual(['p1']);
    expect(changes).toBe(1);
  });

  it('lists only issues, or only notes, when asked', () => {
    list.proposals = [fix('p1')];
    list.issues = [issue('a'), issue('note', { severity: 'info' }), issue('fixable', { severity: 'info', proposal_id: 'p1' })];
    list.kind = 'issues';
    expect(list.listed.map(i => i.id)).toEqual(['fixable', 'a']);              // a note with a fix is an issue to act on
    expect(list.notes).toBe(0);
    list.kind = 'notes';
    expect(list.listed.map(i => i.id)).toEqual(['note']);
  });
});
