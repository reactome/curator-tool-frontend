import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, map, merge, switchMap, takeUntil, takeWhile, timer } from 'rxjs';
import { ExistingMatch, Issue, PaperInfo, paperLabel, Proposal, QAPriority, ReactionRef, SessionDetail } from '../../models/llm-api.models';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { UserInstances } from 'src/app/core/models/reactome-instance.model';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';
import { LoadStagingDialogComponent } from '../load-staging-dialog/load-staging-dialog.component';
import { ReferencePreparer } from '../../services/reference-preparer.service';
import { CHECKED_REACTIONS_KEY, LOADED_SESSION_KEY, selectReactions } from '../../services/staging';

@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.scss']
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  id = '';
  session: SessionDetail | null = null;
  issues: Issue[] = [];
  existing: ExistingMatch[] = [];
  /** Fixes the service suggests, as pending proposals: nothing is applied until the curator accepts one. */
  suggestions: Proposal[] = [];
  selectedKey: string | null = null;
  /** Keys of the reactions the curator checked to load into staged instances. Nothing is checked at first. */
  checkedKeys = new Set<string>();
  tab = 0;
  error: string | null = null;
  /** An edit was accepted since the instances were last loaded into staging. */
  stagingStale = false;

  private destroy$ = new Subject<void>();
  private restart$ = new Subject<void>();

  loading = false;
  /** What a load is doing while it prepares, shown to the curator; null when nothing is going on. */
  loadStep: string | null = null;
  /** Bumped when something that spends tokens may have happened, so the usage tab reloads. */
  usageStamp = 0;
  /** Bumped when the draft may have changed, so the network redraws and the open reaction panel re-reads its reaction. */
  draftStamp = 0;
  /** Width in px of the reaction panel beside the network; the curator drags the divider to change it. */
  detailWidth = WorkspaceComponent.readDetailWidth();
  resizing = false;

  static readonly DETAIL_WIDTH_KEY = 'paper2path.networkDetailWidth';
  static readonly DEFAULT_DETAIL_WIDTH = 380;
  static readonly MIN_DETAIL_WIDTH = 260;
  /** The network keeps at least this much, so the divider cannot squeeze it away. */
  static readonly MIN_NETWORK_WIDTH = 320;

  constructor(private api: LlmApiService, private route: ActivatedRoute, private location: Location,
              private dialog: MatDialog, private snack: MatSnackBar, private userInstances: UserInstancesService,
              private references: ReferencePreparer) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.id = p.get('id') ?? '';
      this.session = null;
      this.issues = [];
      this.existing = [];
      this.suggestions = [];
      this.selectedKey = null;
      this.checkedKeys = this.readChecked();
      this.watch();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get active(): boolean {
    return !!this.session && (this.session.status === 'queued' || this.session.status === 'running');
  }

  readonly paperLabel = paperLabel;

  /** The papers of this annotation (one for an older session). */
  get papers(): PaperInfo[] {
    return this.session?.papers ?? [];
  }

  /** A single paper by its PMID or file name; several by their number (the list is shown beside it). */
  get title(): string {
    const s = this.session;
    if (!s) return '';
    if (this.papers.length > 1 || (s.n_papers ?? 1) > 1) return `${s.n_papers ?? this.papers.length} papers`;
    return s.pmid ? `PMID ${s.pmid}` : s.source;
  }

  get openIssues(): Issue[] {
    return this.issues.filter(i => i.status === 'open');
  }

  /** Follow the session while it is being annotated; once it settles, load what the curator reviews. */
  private watch(): void {
    this.restart$.next();
    timer(0, 3000).pipe(
      takeUntil(merge(this.restart$, this.destroy$)),
      switchMap(() => this.api.session(this.id)),
      takeWhile(s => s.status === 'queued' || s.status === 'running', true)
    ).subscribe({
      next: s => {
        this.session = s;
        this.error = null;
        if (s.status === 'ready') this.loadReview();
      },
      error: (e: LlmApiError) => this.error = e.message
    });
  }

  /** Re-read the session, its issues and its existing-reaction matches (after an edit, QA, or a status change). */
  reload(): void {
    this.usageStamp++;
    forkJoin({ session: this.api.session(this.id), issues: this.api.issues(this.id), existing: this.api.existing(this.id),
               proposals: this.api.proposals(this.id, 'pending') })
      .subscribe({
        next: r => {
          this.session = r.session; this.issues = r.issues; this.existing = r.existing;
          this.suggestions = r.proposals.filter(p => p.actor === 'suggestions');
          this.followRemovals();
          // only now: the reaction panel, network and chat re-read what they show, and the selection is already valid
          this.draftStamp++;
          this.error = null;
        },
        error: (e: LlmApiError) => this.error = e.message
      });
  }

  private loadReview(): void {
    forkJoin({ issues: this.api.issues(this.id), existing: this.api.existing(this.id), proposals: this.api.proposals(this.id, 'pending') }).subscribe({
      next: r => {
        this.issues = r.issues;
        this.existing = r.existing;
        this.suggestions = r.proposals.filter(p => p.actor === 'suggestions');
        if (!this.selectedKey && this.session?.reactions.length) this.selectedKey = this.session.reactions[0].key;
      },
      error: (e: LlmApiError) => this.error = e.message
    });
  }

  /**
   * Put this annotation's instances into the staged instances, replacing what is staged (which is backed
   * up first). The counts are fetched before asking, so the curator confirms with real numbers.
   */
  loadIntoStaging(): void {
    if (this.loading || !this.checkedCount) return;
    this.loading = true;
    this.loadStep = 'Filling in the cited papers from PubMed…';
    const reactions = this.checkedCount;
    const dbIds = this.checkedDbIds;
    // the annotation's pathway holds all its reactions, so it comes only when every one of them is loaded
    const pathway = this.allChecked;
    this.api.exportInstances(this.id).pipe(
      map(all => selectReactions(all, dbIds, pathway)),
      switchMap(selected => this.references.prepare(selected, this.id, this.loadableReactions, this.papers)),
      switchMap(({ exported, report }) =>
        this.userInstances.stagedSummary(exported as UserInstances).pipe(map(summary => ({ exported, summary, report }))))
    ).subscribe({
      next: ({ exported, summary, report }) => {
        this.loadStep = null;
        this.dialog.open(LoadStagingDialogComponent, {
          data: { staged: summary.replaced, keepsDefaultPerson: summary.keepsDefaultPerson,
                  keepsBookmarks: summary.keepsBookmarks, incoming: exported.newInstances.length, stale: this.stagingStale,
                  reactions, totalReactions: this.loadableReactions.length, pathway, references: report }
        }).afterClosed().subscribe(confirmed => {
          if (!confirmed) { this.loading = false; return; }
          this.userInstances.loadAnnotationInstances(exported as UserInstances).subscribe({
            next: r => {
              this.loading = false;
              this.stagingStale = false;
              localStorage.setItem(LOADED_SESSION_KEY, this.id);
              const backup = r.backedUp ? ` Your previous ${r.replaced} staged item(s) were backed up${r.backupFile ? ' (' + r.backupFile + ')' : ''}.` : '';
              const mine = [r.keptDefaultPerson ? 'default person' : '', r.keptBookmarks ? `${r.keptBookmarks} bookmark${r.keptBookmarks === 1 ? '' : 's'}` : ''].filter(Boolean);
              const kept = mine.length ? ` Kept as they are: your ${mine.join(' and ')}.` : '';
              const pdfs = report.pdfs.length
                ? ` ${report.pdfs.length} reference${report.pdfs.length === 1 ? ' needs a PubMed ID' : 's need PubMed IDs'}.` : '';
              this.snack.open(`Loaded ${reactions} reaction${reactions === 1 ? '' : 's'} (${r.loaded} instances).${backup}${kept}${pdfs}`, 'Open schema view', { duration: 12000 })
                .onAction().subscribe(() => this.openSchemaView());
            },
            error: (e: Error) => { this.loading = false; this.error = e.message; }
          });
        });
      },
      error: (e: Error) => { this.loading = false; this.loadStep = null; this.error = e.message; }
    });
  }

  /**
   * Schema View in a new tab, so this annotation stays open. Location adds the application's base path
   * (for example /curatortool/ in production) that a bare '/schema_view' would miss.
   */
  openSchemaView(): void {
    window.open(this.location.prepareExternalUrl('/schema_view'), '_blank', 'noopener');
  }

  /** Reactions that can be loaded: those the export knows by a dbId. */
  get loadableReactions(): ReactionRef[] {
    return (this.session?.reactions ?? []).filter(r => r.dbId !== null && r.dbId !== undefined);
  }

  /** Only reactions still in the annotation count: one removed by an edit drops out of the choice. */
  get checkedCount(): number {
    return this.loadableReactions.filter(r => this.checkedKeys.has(r.key)).length;
  }

  get allChecked(): boolean {
    return this.loadableReactions.length > 0 && this.checkedCount === this.loadableReactions.length;
  }

  private get checkedDbIds(): number[] {
    return this.loadableReactions.filter(r => this.checkedKeys.has(r.key)).map(r => r.dbId!);
  }

  isChecked(key: string | null): boolean {
    return !!key && this.checkedKeys.has(key);
  }

  canCheck(key: string | null): boolean {
    return this.loadableReactions.some(r => r.key === key);
  }

  /**
   * A reaction may have gone (removed from its panel, from the Issues tab, or by an accepted edit): select another one
   * and forget it in the "checked to load" set.
   */
  private followRemovals(): void {
    const keys = new Set((this.session?.reactions ?? []).map(r => r.key));
    if (this.selectedKey && !keys.has(this.selectedKey)) this.selectedKey = this.session?.reactions[0]?.key ?? null;
    const kept = new Set([...this.checkedKeys].filter(k => keys.has(k)));
    if (kept.size !== this.checkedKeys.size) {
      this.checkedKeys = kept;
      this.saveChecked();
    }
  }

  /** The curator removed a reaction in its panel: select its neighbour in the list as shown, then re-read everything. */
  onReactionRemoved(key: string): void {
    const list = this.sortedReactions;
    const at = list.findIndex(r => r.key === key);
    const next = list[at + 1] ?? list[at - 1] ?? null;
    this.selectedKey = next && next.key !== key ? next.key : null;
    this.stagingStale = true;
    this.reload();
  }

  setChecked(key: string, checked: boolean): void {
    const next = new Set(this.checkedKeys);
    if (checked) next.add(key); else next.delete(key);
    this.checkedKeys = next;
    this.saveChecked();
  }

  setAllChecked(checked: boolean): void {
    this.checkedKeys = new Set(checked ? this.loadableReactions.map(r => r.key) : []);
    this.saveChecked();
  }

  /** The choice is kept per annotation, so it is still there when the curator comes back to it. */
  private readChecked(): Set<string> {
    try {
      const saved = JSON.parse(localStorage.getItem(CHECKED_REACTIONS_KEY + this.id) ?? '[]');
      return new Set(Array.isArray(saved) ? saved.filter((k): k is string => typeof k === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private saveChecked(): void {
    if (this.checkedKeys.size) localStorage.setItem(CHECKED_REACTIONS_KEY + this.id, JSON.stringify([...this.checkedKeys]));
    else localStorage.removeItem(CHECKED_REACTIONS_KEY + this.id);
  }

  /** A chat turn ended: its tokens are now recorded. */
  onTurnDone(): void {
    this.usageStamp++;
  }

  select(key: string): void {
    this.selectedKey = key;
  }

  openReaction(key: string): void {
    this.selectedKey = key;
    this.tab = 0;
  }

  onIssueChanged(updated: Issue): void {
    this.issues = this.issues.map(i => i.id === updated.id ? updated : i);
    if (this.session) this.session = { ...this.session, n_open_issues: this.openIssues.length };
  }

  /** How the reaction list is ordered: as in the paper (the draft's order), what needs attention first, or by name. */
  reactionSort: 'paper' | 'attention' | 'name' = 'paper';

  /**
   * The open issues of a reaction as the Issues tab lists them: not notes, not issues waiting on a keep-or-remove
   * decision, and not the keep question itself (the row shows that as "Keep?").
   */
  private listedIssues(key: string): Issue[] {
    return this.issues.filter(i => i.reaction_key === key && i.status === 'open' && i.severity !== 'info'
      && !i.blocked_by && i.category !== 'keep');
  }

  openCount(key: string): number {
    return this.listedIssues(key).length;
  }

  worstSeverity(key: string): string {
    const open = this.listedIssues(key);
    return open.some(i => i.severity === 'action') ? 'action' : open.length ? 'warning' : '';
  }

  /** The reaction waits on a keep-or-remove decision (it may not be a reaction, or no result of the paper shows it). */
  needsDecision(key: string): boolean {
    return this.issues.some(i => i.reaction_key === key && i.status === 'open' && i.category === 'keep');
  }

  /** The keep question's reasons, for the row's tooltip. */
  decisionReason(key: string): string {
    return this.issues.filter(i => i.reaction_key === key && i.status === 'open' && i.category === 'keep').map(i => i.message).join(' / ');
  }

  /** 0: keep or remove? then the QA priority (fix first, fix, review, ok); unchecked reactions by their worst issue. */
  private attentionRank(key: string): number {
    if (this.needsDecision(key)) return 0;
    const rank: Record<QAPriority, number> = { fix_first: 1, fix: 2, review: 3, ok: 4 };
    const qa = this.session?.qa?.[key];
    if (qa) return rank[qa.priority];
    const worst = this.worstSeverity(key);
    return worst === 'action' ? 2 : worst === 'warning' ? 3 : 4;
  }

  get sortedReactions(): ReactionRef[] {
    const list = [...(this.session?.reactions ?? [])];
    const byKey = (a: ReactionRef, b: ReactionRef) => a.key.localeCompare(b.key, undefined, { numeric: true });
    if (this.reactionSort === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || byKey(a, b));
    }
    if (this.reactionSort === 'attention') {
      const pos = new Map(list.map((r, i) => [r.key, i]));
      return list.sort((a, b) => this.attentionRank(a.key) - this.attentionRank(b.key)
        || this.openCount(b.key) - this.openCount(a.key) || pos.get(a.key)! - pos.get(b.key)!);
    }
    return list;
  }

  /** The selected reaction, as context for the chat. Its dbId is the one the instances were exported with. */
  get selectedReaction(): { name: string; dbId: number | null } | null {
    const r = this.session?.reactions.find(x => x.key === this.selectedKey);
    return r ? { name: r.name, dbId: r.dbId } : null;
  }

  get contextDbIds(): number[] {
    const id = this.selectedReaction?.dbId;
    return id === null || id === undefined ? [] : [id];
  }

  /** The name of the first reaction a suggestion is about, for its heading. */
  suggestionReaction(p: Proposal): string {
    return this.session?.reactions.find(r => p.reaction_keys.includes(r.key))?.name ?? '';
  }

  onProposalDecided(p: Proposal): void {
    if (p.status === 'accepted') this.stagingStale = true;
    this.reload();
  }

  /**
   * Drag the divider between the network and the reaction panel. The pointer is captured by the divider, so
   * the drag keeps going when it passes over the network canvas, which would otherwise take the events.
   */
  startResize(event: PointerEvent, split: HTMLElement): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    this.resizing = true;
    const move = (e: PointerEvent) => this.resizeTo(e.clientX, split);
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      this.resizing = false;
      this.saveDetailWidth();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /** The panel spans from the pointer to the right edge of the split, within the limits. */
  resizeTo(clientX: number, split: HTMLElement): void {
    this.detailWidth = this.clampDetailWidth(split.getBoundingClientRect().right - clientX, split.clientWidth);
  }

  /** Arrow keys move the divider for curators who do not use a mouse; Home puts it back. */
  nudgeDivider(event: KeyboardEvent, split: HTMLElement): void {
    const step = event.shiftKey ? 80 : 20;
    if (event.key === 'ArrowLeft') this.detailWidth = this.clampDetailWidth(this.detailWidth + step, split.clientWidth);
    else if (event.key === 'ArrowRight') this.detailWidth = this.clampDetailWidth(this.detailWidth - step, split.clientWidth);
    else if (event.key === 'Home') this.detailWidth = WorkspaceComponent.DEFAULT_DETAIL_WIDTH;
    else return;
    event.preventDefault();
    this.saveDetailWidth();
  }

  resetDetailWidth(): void {
    this.detailWidth = WorkspaceComponent.DEFAULT_DETAIL_WIDTH;
    this.saveDetailWidth();
  }

  private clampDetailWidth(width: number, splitWidth: number): number {
    const max = Math.max(WorkspaceComponent.MIN_DETAIL_WIDTH, splitWidth - WorkspaceComponent.MIN_NETWORK_WIDTH);
    return Math.round(Math.min(max, Math.max(WorkspaceComponent.MIN_DETAIL_WIDTH, width)));
  }

  private saveDetailWidth(): void {
    localStorage.setItem(WorkspaceComponent.DETAIL_WIDTH_KEY, String(this.detailWidth));
  }

  private static readDetailWidth(): number {
    const saved = Number(localStorage.getItem(WorkspaceComponent.DETAIL_WIDTH_KEY));
    return saved >= WorkspaceComponent.MIN_DETAIL_WIDTH ? saved : WorkspaceComponent.DEFAULT_DETAIL_WIDTH;
  }

  hasSameMatch(key: string): boolean {
    return this.existing.some(m => m.reaction_key === key && m.level === 'same');
  }
}
