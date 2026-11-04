import { SimpleChange } from '@angular/core';
import { Subject, of } from 'rxjs';
import { QAResult, ReactionDetail } from '../../models/llm-api.models';
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
