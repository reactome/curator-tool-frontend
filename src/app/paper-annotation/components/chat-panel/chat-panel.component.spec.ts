import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import { ChatEvent, Proposal } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';
import { PaperAnnotationModule } from '../../paper-annotation.module';
import { ChatPanelComponent } from './chat-panel.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('ChatPanelComponent', () => {
  const proposal = (id: string, status: Proposal['status'] = 'pending'): Proposal => ({
    id, reason: 'add the damage condition', ops: [], summary: ['reaction r0.regulations: [] -> [...]'], reaction_keys: ['r0'],
    evidence: [], actor: 'chat', status, created: 1, decided_by: null, decided_at: null });

  let api: jasmine.SpyObj<LlmApiService>;
  let fixture: ComponentFixture<ChatPanelComponent>;
  let component: ChatPanelComponent;
  let stream: Subject<ChatEvent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const emit = (e: ChatEvent) => { stream.next(e); fixture.detectChanges(); };

  const create = (history: any[] = [], proposals: Proposal[] = []) => {
    api = jasmine.createSpyObj('LlmApiService', ['chatHistory', 'proposals', 'streamChat', 'accept', 'reject']);
    api.chatHistory.and.returnValue(of(history));
    api.proposals.and.returnValue(of(proposals));
    stream = new Subject<ChatEvent>();
    api.streamChat.and.returnValue(stream);
    TestBed.configureTestingModule({
      imports: [PaperAnnotationModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: LlmApiService, useValue: api }]
    });
    fixture = TestBed.createComponent(ChatPanelComponent);
    component = fixture.componentInstance;
    component.sessionId = 's1';
    component.contextLabel = 'PINK1 phosphorylates Ub';
    component.contextDbIds = [-5];
    fixture.detectChanges();
  };

  it('shows stored history with its proposal cards after a reload', () => {
    create([{ role: 'user', text: 'add CCCP', at: 1, proposal_ids: [] }, { role: 'assistant', text: 'I proposed it.', at: 2, proposal_ids: ['p-001'] }],
      [proposal('p-001', 'accepted')]);
    expect(el().textContent).toContain('add CCCP');
    expect(el().textContent).toContain('I proposed it.');
    expect(el().querySelector('app-proposal-card')?.textContent).toContain('accepted');
  });

  it('explains how to start when the conversation is empty', () => {
    create();
    expect(el().textContent).toContain('nothing changes until you accept them');
  });

  it('streams a reply: steps in plain words, text as it arrives, then a proposal card', () => {
    create();
    component.draft = 'Add the damage condition';
    component.send();
    fixture.detectChanges();
    expect(component.sending).toBeTrue();
    emit({ event: 'tool', data: { name: 'search_paper', input: {} } });
    emit({ event: 'tool', data: { name: 'search_paper', input: {} } });
    emit({ event: 'tool', data: { name: 'propose_patch', input: {} } });
    emit({ event: 'proposal', data: proposal('p-007') });
    emit({ event: 'text', data: { delta: 'I proposed ' } });
    emit({ event: 'text', data: { delta: 'adding CCCP.' } });
    expect(el().textContent).toContain('Searching the paper…');
    expect(el().textContent).toContain('Preparing an edit…');
    expect((el().textContent!.match(/Searching the paper/g) || []).length).toBe(1);      // repeated steps collapse
    expect(el().textContent).toContain('I proposed adding CCCP.');
    expect(el().querySelector('app-proposal-card')?.textContent).toContain('p-007');
    emit({ event: 'done', data: { proposalIds: ['p-007'] } });
    stream.complete();
    fixture.detectChanges();
    expect(component.sending).toBeFalse();
    expect(component.turns[component.turns.length - 1].streaming).toBeFalse();
  });

  it('sends the selected reaction as context only when the box is ticked', () => {
    create();
    component.draft = 'hi';
    component.send();
    expect(api.streamChat).toHaveBeenCalledWith('s1', 'hi', [-5]);
    stream.complete();
    component.useContext = false;
    component.draft = 'again';
    component.send();
    expect(api.streamChat.calls.mostRecent().args).toEqual(['s1', 'again', []]);
  });

  it('ignores empty messages and a second send while one is streaming', () => {
    create();
    component.draft = '   ';
    component.send();
    expect(api.streamChat).not.toHaveBeenCalled();
    component.draft = 'one';
    component.send();
    component.draft = 'two';
    component.send();
    expect(api.streamChat).toHaveBeenCalledTimes(1);
  });

  it('Enter sends and Shift+Enter does not', () => {
    create();
    component.draft = 'hello';
    const shift = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true });
    component.onEnter(shift);
    expect(api.streamChat).not.toHaveBeenCalled();
    expect(shift.defaultPrevented).toBeFalse();
    const plain = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    component.onEnter(plain);
    expect(api.streamChat).toHaveBeenCalledTimes(1);
    expect(plain.defaultPrevented).toBeTrue();
  });

  it('shows a failed request and an in-turn error without losing what was said', () => {
    create();
    component.draft = 'go';
    component.send();
    emit({ event: 'text', data: { delta: 'partial' } });
    emit({ event: 'error', data: { message: 'overloaded' } });
    expect(el().textContent).toContain('partial');
    expect(el().textContent).toContain('overloaded');
    stream.error(new LlmApiError(409, 'session is running; chat needs a ready session'));
    fixture.detectChanges();
    expect(el().textContent).toContain('chat needs a ready session');
    expect(component.sending).toBeFalse();
  });

  it('Stop ends the stream and says so', () => {
    create();
    component.draft = 'go';
    component.send();
    emit({ event: 'text', data: { delta: 'working' } });
    expect(stream.observed).toBeTrue();
    component.stop();
    fixture.detectChanges();
    expect(stream.observed).toBeFalse();
    expect(component.sending).toBeFalse();
    expect(el().textContent).toContain('Stopped.');
  });

  it('tells the workspace when a proposal is decided', () => {
    create([{ role: 'assistant', text: 'x', at: 1, proposal_ids: ['p-001'] }], [proposal('p-001')]);
    api.accept.and.returnValue(of({ proposal: proposal('p-001', 'accepted'), reactions: [], nOpenIssues: 0 }));
    const decided: Proposal[] = [];
    component.proposalDecided.subscribe(p => decided.push(p));
    const accept = fixture.debugElement.queryAll(By.css('app-proposal-card button')).find(b => b.nativeElement.textContent.includes('Accept'))!;
    accept.nativeElement.click();
    fixture.detectChanges();
    expect(api.accept).toHaveBeenCalledWith('s1', 'p-001');
    expect(decided[0].status).toBe('accepted');
    expect(el().querySelector('app-proposal-card')?.textContent).toContain('accepted');
  });

  describe('the thinking indicator', () => {
    const thinking = () => el().querySelector('.thinking');

    it('shows while waiting for the first words, keeps showing between steps, and goes away once text arrives', () => {
      create();
      component.draft = 'go';
      component.send();
      fixture.detectChanges();
      expect(thinking()?.textContent).toContain('Thinking');
      expect(thinking()?.getAttribute('role')).toBe('status');                       // announced to screen readers
      emit({ event: 'tool', data: { name: 'search_paper', input: {} } });
      expect(thinking()).not.toBeNull();                                             // still waiting for the answer
      expect(el().textContent).toContain('Searching the paper…');
      emit({ event: 'text', data: { delta: 'The paper shows' } });
      expect(thinking()).toBeNull();
      expect(el().querySelector('.cursor')).not.toBeNull();                          // cursor only once there is text
    });

    it('shows no cursor while there is no text yet', () => {
      create();
      component.draft = 'go';
      component.send();
      fixture.detectChanges();
      expect(el().querySelector('.cursor')).toBeNull();
    });

    it('goes away when the turn ends without text, fails, or is stopped', () => {
      create();
      component.draft = 'one';
      component.send();
      fixture.detectChanges();
      emit({ event: 'done', data: { proposalIds: [] } });
      stream.complete();                                                             // the server ends the stream after 'done'
      fixture.detectChanges();
      expect(thinking()).toBeNull();
      stream = new Subject<ChatEvent>();
      api.streamChat.and.returnValue(stream);
      component.draft = 'two';
      component.send();
      fixture.detectChanges();
      expect(thinking()).not.toBeNull();
      stream.error(new LlmApiError(0, 'The annotation service is not reachable.'));
      fixture.detectChanges();
      expect(thinking()).toBeNull();
      stream = new Subject<ChatEvent>();
      api.streamChat.and.returnValue(stream);
      component.draft = 'three';
      component.send();
      fixture.detectChanges();
      component.stop();
      fixture.detectChanges();
      expect(thinking()).toBeNull();
    });

    it('is not shown for stored history', () => {
      create([{ role: 'user', text: 'hi', at: 1, proposal_ids: [] }, { role: 'assistant', text: 'hello', at: 2, proposal_ids: [] }]);
      expect(thinking()).toBeNull();
    });
  });
});
