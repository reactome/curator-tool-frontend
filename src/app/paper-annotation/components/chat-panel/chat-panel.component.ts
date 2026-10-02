import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { ChatEvent, Proposal } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  /** What the assistant is doing, in plain words ("Searching the paper"). */
  steps: string[];
  proposalIds: string[];
  streaming?: boolean;
  error?: string;
}

const STEP_LABELS: Record<string, string> = {
  list_reactions: 'Looking at the reactions',
  get_reaction: 'Reading a reaction',
  search_paper: 'Searching the paper',
  resolve_identifier: 'Looking up an identifier',
  find_existing_reactome: 'Checking Reactome for existing reactions',
  run_qa: 'Checking the reaction',
  propose_patch: 'Preparing an edit',
};

@Component({
  selector: 'app-chat-panel',
  templateUrl: './chat-panel.component.html',
  styleUrls: ['./chat-panel.component.scss']
})
export class ChatPanelComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input({ required: true }) sessionId!: string;
  /** The reaction selected in the workspace, offered to the assistant as context. */
  @Input() contextLabel: string | null = null;
  @Input() contextDbIds: number[] = [];
  /** An edit was accepted or rejected: the workspace should reload. */
  @Output() proposalDecided = new EventEmitter<Proposal>();

  @ViewChild('log') log?: ElementRef<HTMLElement>;

  turns: Turn[] = [];
  proposals = new Map<string, Proposal>();
  draft = '';
  sending = false;
  useContext = true;
  error: string | null = null;

  private sub: Subscription | null = null;
  private scrollPending = false;

  constructor(private api: LlmApiService) {}

  ngOnInit(): void {
    forkJoin({ history: this.api.chatHistory(this.sessionId), proposals: this.api.proposals(this.sessionId) }).subscribe({
      next: r => {
        r.proposals.forEach(p => this.proposals.set(p.id, p));
        this.turns = r.history.map(m => ({ role: m.role, text: m.text, steps: [], proposalIds: m.proposal_ids }));
        this.scrollPending = true;
      },
      error: (e: LlmApiError) => this.error = e.message
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.scrollPending && this.log) {
      this.log.nativeElement.scrollTop = this.log.nativeElement.scrollHeight;
      this.scrollPending = false;
    }
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return;           // Shift+Enter inserts a newline
    e.preventDefault();
    this.send();
  }

  send(): void {
    const message = this.draft.trim();
    if (!message || this.sending) return;
    this.error = null;
    this.draft = '';
    this.turns.push({ role: 'user', text: message, steps: [], proposalIds: [] });
    const reply: Turn = { role: 'assistant', text: '', steps: [], proposalIds: [], streaming: true };
    this.turns.push(reply);
    this.sending = true;
    this.scrollPending = true;
    const ids = this.useContext ? this.contextDbIds.filter(id => id !== null && id !== undefined) : [];
    this.sub = this.api.streamChat(this.sessionId, message, ids).subscribe({
      next: ev => { this.handle(reply, ev); this.scrollPending = true; },
      error: (e: LlmApiError) => { reply.streaming = false; reply.error = e.message; this.sending = false; },
      complete: () => { reply.streaming = false; this.sending = false; }
    });
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = null;
    const last = this.turns[this.turns.length - 1];
    if (last?.streaming) { last.streaming = false; last.error = 'Stopped.'; }
    this.sending = false;
  }

  private handle(reply: Turn, ev: ChatEvent): void {
    switch (ev.event) {
      case 'text': reply.text += ev.data.delta; break;
      case 'tool': {
        const label = STEP_LABELS[ev.data.name] ?? ev.data.name;
        if (reply.steps[reply.steps.length - 1] !== label) reply.steps.push(label);
        break;
      }
      case 'proposal':
        this.proposals.set(ev.data.id, ev.data);
        reply.proposalIds.push(ev.data.id);
        break;
      case 'error': reply.error = ev.data.message; break;
      case 'done': reply.streaming = false; break;
    }
  }

  onDecided(p: Proposal): void {
    this.proposals.set(p.id, p);
    this.proposalDecided.emit(p);
  }
}
