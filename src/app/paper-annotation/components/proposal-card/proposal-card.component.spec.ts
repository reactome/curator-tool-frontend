import { of, throwError } from 'rxjs';
import { Proposal } from '../../models/llm-api.models';
import { LlmApiError } from '../../services/llm-api.service';
import { ProposalCardComponent } from './proposal-card.component';

describe('ProposalCardComponent', () => {
  const proposal = (status: Proposal['status'] = 'pending'): Proposal => ({
    id: 'p-001', reason: 'r', ops: [], summary: ['s'], reaction_keys: ['r0'], evidence: [], actor: 'chat', status,
    created: 1, decided_by: null, decided_at: null });
  let api: jasmine.SpyObj<any>;
  let card: ProposalCardComponent;
  let decided: Proposal[];

  beforeEach(() => {
    api = jasmine.createSpyObj('LlmApiService', ['accept', 'reject', 'proposals']);
    card = new ProposalCardComponent(api);
    card.sessionId = 's1';
    card.proposal = proposal();
    decided = [];
    card.decided.subscribe(p => decided.push(p));
  });

  it('accepting emits the accepted proposal', () => {
    api.accept.and.returnValue(of({ proposal: proposal('accepted'), reactions: [], nOpenIssues: 0 }));
    card.accept();
    expect(api.accept).toHaveBeenCalledWith('s1', 'p-001');
    expect(decided.map(p => p.status)).toEqual(['accepted']);
    expect(card.busy).toBeFalse();
  });

  it('rejecting emits the rejected proposal', () => {
    api.reject.and.returnValue(of(proposal('rejected')));
    card.reject();
    expect(decided.map(p => p.status)).toEqual(['rejected']);
  });

  it('a 409 shows the reason and refreshes to the real state (decided elsewhere or gone stale)', () => {
    api.accept.and.returnValue(throwError(() => new LlmApiError(409, 'proposal no longer applies to the current draft: unknown participant')));
    api.proposals.and.returnValue(of([proposal('stale')]));
    card.accept();
    expect(card.error).toContain('no longer applies');
    expect(decided.map(p => p.status)).toEqual(['stale']);
    expect(card.busy).toBeFalse();
  });

  it('any other failure shows the reason and leaves the proposal as it was', () => {
    api.accept.and.returnValue(throwError(() => new LlmApiError(0, 'The annotation service is not reachable.')));
    card.accept();
    expect(card.error).toContain('not reachable');
    expect(decided).toEqual([]);
    expect(api.proposals).not.toHaveBeenCalled();
  });

  it('describes each status in plain words', () => {
    expect(card.statusLabel).toBe('waiting for your decision');
    card.proposal = proposal('stale');
    expect(card.statusLabel).toContain('no longer applies');
  });
});
