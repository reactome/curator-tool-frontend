import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, map, merge, switchMap, takeUntil, takeWhile, timer } from 'rxjs';
import { ExistingMatch, Issue, Proposal, SessionDetail } from '../../models/llm-api.models';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { UserInstances } from 'src/app/core/models/reactome-instance.model';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';
import { LoadStagingDialogComponent } from '../load-staging-dialog/load-staging-dialog.component';
import { LOADED_SESSION_KEY } from '../../services/staging';

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
  selectedKey: string | null = null;
  tab = 0;
  error: string | null = null;
  /** An edit was accepted since the instances were last loaded into staging. */
  stagingStale = false;

  private destroy$ = new Subject<void>();
  private restart$ = new Subject<void>();

  loading = false;
  /** Bumped when something that spends tokens may have happened, so the usage tab reloads. */
  usageStamp = 0;
  /** Bumped when the draft may have changed, so the network tab redraws. */
  networkStamp = 0;

  constructor(private api: LlmApiService, private route: ActivatedRoute, private location: Location,
              private dialog: MatDialog, private snack: MatSnackBar, private userInstances: UserInstancesService) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.id = p.get('id') ?? '';
      this.session = null;
      this.issues = [];
      this.existing = [];
      this.selectedKey = null;
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
    this.networkStamp++;
    forkJoin({ session: this.api.session(this.id), issues: this.api.issues(this.id), existing: this.api.existing(this.id) })
      .subscribe({
        next: r => { this.session = r.session; this.issues = r.issues; this.existing = r.existing; this.error = null; },
        error: (e: LlmApiError) => this.error = e.message
      });
  }

  private loadReview(): void {
    forkJoin({ issues: this.api.issues(this.id), existing: this.api.existing(this.id) }).subscribe({
      next: r => {
        this.issues = r.issues;
        this.existing = r.existing;
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
    if (this.loading) return;
    this.loading = true;
    this.api.exportInstances(this.id).pipe(
      switchMap(exported => this.userInstances.stagedSummary(exported as UserInstances).pipe(map(summary => ({ exported, summary }))))
    ).subscribe({
      next: ({ exported, summary }) => {
        this.dialog.open(LoadStagingDialogComponent, {
          data: { staged: summary.replaced, keepsDefaultPerson: summary.keepsDefaultPerson,
                  keepsBookmarks: summary.keepsBookmarks, incoming: exported.newInstances.length, stale: this.stagingStale }
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
              this.snack.open(`Loaded ${r.loaded} instances.${backup}${kept}`, 'Open schema view', { duration: 12000 })
                .onAction().subscribe(() => this.openSchemaView());
            },
            error: (e: Error) => { this.loading = false; this.error = e.message; }
          });
        });
      },
      error: (e: Error) => { this.loading = false; this.error = e.message; }
    });
  }

  /**
   * Schema View in a new tab, so this annotation stays open. Location adds the application's base path
   * (for example /curatortool/ in production) that a bare '/schema_view' would miss.
   */
  openSchemaView(): void {
    window.open(this.location.prepareExternalUrl('/schema_view'), '_blank', 'noopener');
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

  openCount(key: string): number {
    return this.issues.filter(i => i.reaction_key === key && i.status === 'open').length;
  }

  worstSeverity(key: string): string {
    const open = this.issues.filter(i => i.reaction_key === key && i.status === 'open');
    return open.some(i => i.severity === 'action') ? 'action' : open.length ? 'warning' : '';
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

  onProposalDecided(p: Proposal): void {
    if (p.status === 'accepted') this.stagingStale = true;
    this.reload();
  }

  hasSameMatch(key: string): boolean {
    return this.existing.some(m => m.reaction_key === key && m.level === 'same');
  }
}
