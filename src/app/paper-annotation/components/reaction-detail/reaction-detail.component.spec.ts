import { of } from 'rxjs';
import { QAResult } from '../../models/llm-api.models';
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
