import { AfterViewChecked, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, Subscription, takeUntil, interval, forkJoin } from 'rxjs';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { DataService } from 'src/app/core/services/data.service';
import {
  AnnotationJobStatus,
  CrewAIDashboardConfig,
  CrewAILogEntry,
  PreloadedPaper,
  Paper2pathService
} from 'src/app/paper2path/services/paper2path.service';

export interface PaperItem {
  pmid: string;
  title?: string;
  exists?: boolean;
  selected?: boolean;
  sizeBytes?: number;
}

export interface AnnotationConfiguration {
  numberOfPubmed: number;
  qualityThreshold: number;
  enableFullText: boolean;
  enableLiteratureSearch: boolean;
  targetGene: string;
}

export interface DashboardSelectionState {
  enabledPhases: Record<string, boolean>;
  enabledAgents: Record<string, boolean>;
  enabledTools: Record<string, Record<string, boolean>>;
}

const DEFAULT_CONFIG: AnnotationConfiguration = {
  numberOfPubmed: 8,
  qualityThreshold: 0.7,
  enableFullText: true,
  enableLiteratureSearch: false,
  targetGene: ''
};

@Component({
  selector: 'app-paper2path',
  templateUrl: './paper2path.component.html',
  styleUrls: ['./paper2path.component.scss']
})
export class Paper2pathComponent implements OnDestroy, AfterViewChecked {
  @ViewChild('logsContainer') logsContainer?: ElementRef<HTMLElement>;

  private destroy$ = new Subject<void>();
  private pollingSubscription: Subscription | null = null;
  private pendingLogScroll = false;
  
  // Form management
  paperForm!: FormGroup;
  configForm!: FormGroup;
  
  // UI state
  selectedTab = 0;
  showConfiguration = false;
  isProcessing = false;
  instancesPushed = false;
  
  // Data
  papers: PaperItem[] = [];
  preloadedPapers: PaperItem[] = [];
  currentJob: AnnotationJobStatus | null = null;
  annotationResult: any = null;
  error: string | null = null;
  logs: CrewAILogEntry[] = [];
  nextLogSince = 0;
  dashboardConfig: CrewAIDashboardConfig | null = null;
  dashboardSelection: DashboardSelectionState = {
    enabledPhases: {},
    enabledAgents: {},
    enabledTools: {}
  };
  
  // Configuration
  configuration: AnnotationConfiguration = { ...DEFAULT_CONFIG };

  constructor(
    private fb: FormBuilder,
    private paper2pathService: Paper2pathService,
    private snackBar: MatSnackBar,
    private store: Store,
    private dataService: DataService
  ) {
    this.initializeForms();
  }

  ngOnDestroy() {
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked() {
    if (this.pendingLogScroll) {
      this.scrollLogsToBottom();
    }
  }

  private initializeForms() {
    this.paperForm = this.fb.group({
      pmids: this.fb.array([]),
      uploadFile: [null]
    });

    this.configForm = this.fb.group({
      numberOfPubmed: [this.configuration.numberOfPubmed, [Validators.min(1), Validators.max(20)]],
      qualityThreshold: [this.configuration.qualityThreshold, [Validators.min(0), Validators.max(1)]],
      enableFullText: [this.configuration.enableFullText],
      enableLiteratureSearch: [this.configuration.enableLiteratureSearch],
      targetGene: [this.configuration.targetGene]
    });
  }

  get pmidsArray(): FormArray {
    return this.paperForm.get('pmids') as FormArray;
  }

  addPmidField(pmid: string = '') {
    this.pmidsArray.push(this.fb.control(pmid, Validators.required));
  }

  removePmidField(index: number) {
    this.pmidsArray.removeAt(index);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.paperForm.patchValue({ uploadFile: file });
    } else {
      this.showError('Please select a valid PDF file');
    }
  }

  loadPreloadedPapers() {
    this.paper2pathService.getPreloadedPapers().subscribe({
      next: (papers: PreloadedPaper[]) => {
        this.preloadedPapers = papers.map(p => ({ pmid: p.pmid, exists: p.exists, sizeBytes: p.sizeBytes, selected: false }));
      },
      error: (err: Error) => {
        console.warn('Could not load preloaded papers:', err.message);
        this.preloadedPapers = [];
      }
    });
  }

  loadDashboardConfig() {
    this.paper2pathService.getDashboardConfig().subscribe({
      next: (config: CrewAIDashboardConfig) => {
        this.dashboardConfig = config;
        this.dashboardSelection.enabledPhases = Object.fromEntries(
          config.phases.map(phase => [phase.id, true])
        );
        this.dashboardSelection.enabledAgents = Object.fromEntries(
          config.agents.map(agent => [agent.id, true])
        );
        this.dashboardSelection.enabledTools = {};
        Object.entries(config.toolsByAgent).forEach(([agentId, tools]) => {
          this.dashboardSelection.enabledTools[agentId] = Object.fromEntries(
            tools.map(tool => [tool.id, true])
          );
        });
      },
      error: (err: Error) => {
        this.showError(`Failed to load agent dashboard configuration: ${err.message}`);
      }
    });
  }

  togglePaperSelection(paper: PaperItem) {
    paper.selected = !paper.selected;
  }

  submitAnnotation() {
    if (this.isProcessing) return;

    const selectedPmids = this.getSelectedPmids();
    const queryGeneCheck = (this.configForm.get('targetGene')?.value as string || '').trim();
    if (selectedPmids.length === 0 && !queryGeneCheck) {
      this.showError('Please provide at least one PMID, a PDF, or a target gene.');
      return;
    }

    this.isProcessing = true;
    this.error = null;
    this.logs = [];
    this.nextLogSince = 0;
    this.updateConfiguration();

    const queryGene = queryGeneCheck;
    if (this.configuration.enableLiteratureSearch && !queryGene) {
      this.showError('Target gene is required when literature search is enabled.');
      this.isProcessing = false;
      return;
    }

    const enabledPhases = this.getEnabledPhaseIds();
    const enabledAgents = this.getEnabledAgentIds();
    const enabledTools = this.getEnabledToolsByAgent();

    this.paper2pathService.submitAnnotation({
      pmids: selectedPmids,
      queryGene: queryGene || undefined,
      ...(enabledPhases !== undefined && { enabledPhases }),
      ...(enabledAgents !== undefined && { enabledAgents }),
      ...(enabledTools !== undefined && { enabledTools }),
      ...this.configuration
    }).subscribe({
      next: (job: AnnotationJobStatus) => {
        this.currentJob = job;
        this.selectedTab = 2;
        this.startPollingForResult();
        this.showSuccess(`Annotation job submitted: ${job.job_id}`);
      },
      error: (err: Error) => {
        this.showError(`Failed to submit annotation: ${err.message}`);
        this.isProcessing = false;
      }
    });
  }

  private getSelectedPmids(): string[] {
    const manualPmids = this.pmidsArray.value.filter((pmid: string) => pmid.trim());
    const selectedPreloaded = this.preloadedPapers
      .filter(p => p.selected)
      .map(p => p.pmid);
    
    return [...manualPmids, ...selectedPreloaded];
  }

  private updateConfiguration() {
    this.configuration = {
      ...this.configuration,
      ...this.configForm.value
    };
  }

  private startPollingForResult() {
    if (!this.currentJob || !this.currentJob.job_id) {
      this.showError('Cannot start polling: invalid job ID');
      this.isProcessing = false;
      return;
    }

    // Ensure only one polling stream is active at a time.
    this.stopPolling();

    const originalJobId = this.currentJob.job_id; // Preserve original job ID

    this.pollingSubscription = interval(3000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        if (!this.currentJob || !originalJobId) {
          this.stopPolling();
          return;
        }

        forkJoin({
          status: this.paper2pathService.getJobStatus(originalJobId),
          logResponse: this.paper2pathService.getJobLogs(originalJobId, this.nextLogSince, 200)
        }).subscribe({
          next: ({ status, logResponse }) => {
            if (logResponse.logs?.length) {
              this.logs = [...this.logs, ...logResponse.logs];
              this.pendingLogScroll = true;
              this.scrollLogsToBottom();
            }
            this.nextLogSince = logResponse.next_since ?? this.nextLogSince;
            this.currentJob = { ...status, job_id: originalJobId };

            if (status.status === 'done') {
              this.annotationResult = status.result;
              this.isProcessing = false;
              this.stopPolling();
              this.showSuccess('Annotation completed successfully!');
            } else if (status.status === 'error') {
              this.error = status.error || 'Unknown error occurred';
              this.isProcessing = false;
              this.stopPolling();
              this.showError(`Annotation failed: ${this.error}`);
            } else if (status.status === 'not_found') {
              this.error = 'Annotation job not found on server.';
              this.isProcessing = false;
              this.stopPolling();
              this.showError(this.error);
            }
            // 'running' — continue polling on next tick
          },
          error: (err: Error) => {
            this.error = `Failed to get job status: ${err.message}`;
            this.isProcessing = false;
            this.stopPolling();
            this.showError(this.error);
          }
        });
      });
  }

  private stopPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  toggleConfiguration() {
    this.showConfiguration = !this.showConfiguration;
    if (this.showConfiguration && !this.dashboardConfig) {
      this.loadDashboardConfig();
    }
  }

  onTabChange(index: number) {
    this.selectedTab = index;
    if (index === 1 && this.preloadedPapers.length === 0) {
      this.loadPreloadedPapers();
    }
    // Results tab can be lazily rendered by Angular Material. Trigger scroll when opened.
    if (index === 2 && this.logs.length > 0) {
      this.pendingLogScroll = true;
      this.scrollLogsToBottom();
    }
  }

  dismissError() {
    this.error = null;
  }

  pushInstancesToStore() {
    if (!this.annotationResult?.reactome_instances?.length) return;

    let count = 0;
    let nextId = -(Math.floor(Date.now() / 1000));

    for (const item of this.annotationResult.reactome_instances) {
      let content: any;
      try { content = JSON.parse(item.content); } catch { continue; }

      const all = [
        ...(content.entities  || []),
        ...(content.reactions || []),
        ...(content.pathways  || [])
      ];
      for (const raw of all) {
        const inst: Instance = {
          dbId: nextId--,
          schemaClassName: raw.class || 'Unknown',
          displayName: raw.displayName
        };
        this.dataService.registerInstance(inst);
        this.store.dispatch(NewInstanceActions.register_new_instance(inst));
        count++;
      }
    }

    this.instancesPushed = true;
    this.showSuccess(`${count} instance${count !== 1 ? 's' : ''} added to schema view.`);
  }

  resetAnnotation() {
    this.stopPolling();
    this.currentJob = null;
    this.annotationResult = null;
    this.error = null;
    this.logs = [];
    this.nextLogSince = 0;
    this.isProcessing = false;
    this.instancesPushed = false;
  }

  private scrollLogsToBottom() {
    setTimeout(() => {
      const element = this.logsContainer?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
        this.pendingLogScroll = false;
      }
    }, 50);
  }

  getEnabledPhaseIds(): string[] | undefined {
    if (!this.dashboardConfig) return undefined;
    return Object.entries(this.dashboardSelection.enabledPhases)
      .filter(([, enabled]) => enabled)
      .map(([phaseId]) => phaseId);
  }

  getEnabledAgentIds(): string[] | undefined {
    if (!this.dashboardConfig) return undefined;
    return Object.entries(this.dashboardSelection.enabledAgents)
      .filter(([, enabled]) => enabled)
      .map(([agentId]) => agentId);
  }

  getEnabledToolsByAgent(): Record<string, string[]> | undefined {
    if (!this.dashboardConfig) return undefined;
    const result: Record<string, string[]> = {};
    Object.entries(this.dashboardSelection.enabledTools).forEach(([agentId, toolMap]) => {
      result[agentId] = Object.entries(toolMap)
        .filter(([, enabled]) => enabled)
        .map(([toolId]) => toolId);
    });
    return result;
  }

  toggleAgent(agentId: string, enabled: boolean) {
    this.dashboardSelection.enabledAgents[agentId] = enabled;
  }

  isToolEnabled(agentId: string, toolId: string): boolean {
    return !!this.dashboardSelection.enabledTools[agentId]?.[toolId];
  }

  setToolEnabled(agentId: string, toolId: string, enabled: boolean) {
    if (!this.dashboardSelection.enabledTools[agentId]) {
      this.dashboardSelection.enabledTools[agentId] = {};
    }
    this.dashboardSelection.enabledTools[agentId][toolId] = enabled;
  }

  formatLogTime(ts?: string): string {
    if (!ts) return '';
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return ts;
    return date.toLocaleTimeString();
  }

  logTag(entry: CrewAILogEntry): string {
    if (entry.event_type) {
      const status = entry.status ? `:${entry.status}` : '';
      return `${entry.event_type}${status}`.toUpperCase();
    }
    if (entry.level) {
      return entry.level.toUpperCase();
    }
    return 'EVENT';
  }

  logTagClass(entry: CrewAILogEntry): string {
    const status = (entry.status || '').toLowerCase();
    const level = (entry.level || '').toLowerCase();
    if (status === 'error' || status === 'failed' || level === 'error') return 'tag-error';
    if (status === 'end' || status === 'success') return 'tag-success';
    if (status === 'start' || status === 'queued') return 'tag-running';
    if (level === 'warning') return 'tag-warning';
    return 'tag-default';
  }

  formatLogSummary(entry: CrewAILogEntry): string {
    if (entry.message) return entry.message;
    const source = entry.agent || entry.tool || entry.phase || entry.logger || 'CrewAI';
    const event = entry.event_type || 'event';
    const status = entry.status ? ` (${entry.status})` : '';
    return `${source} ${event}${status}`;
  }

  getCurrentPhase(): string {
    for (let i = this.logs.length - 1; i >= 0; i -= 1) {
      const phase = this.logs[i]?.phase;
      if (phase) {
        return this.formatPhase(phase);
      }
    }
    return 'Not started';
  }

  formatPhase(phase?: string): string {
    if (!phase) return '';
    return phase
      .replace(/_/g, ' ')
      .replace(/\bphase\b/gi, 'Phase')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  formatLogDetails(entry: CrewAILogEntry): string {
    const detailKeys = ['gene', 'phase', 'agent', 'tool', 'outcome', 'error'];
    const details = detailKeys
      .filter(key => key in entry && entry[key] !== undefined && entry[key] !== null && entry[key] !== '')
      .map(key => `${key}: ${entry[key]}`);
    return details.join(' | ');
  }

  formatExtraDetails(entry: CrewAILogEntry): string {
    const knownKeys = new Set([
      'seq', 'ts', 'event_type', 'status', 'agent', 'tool', 'phase', 'gene', 'outcome', 'error', 'level', 'logger', 'message'
    ]);
    const extraParts = Object.entries(entry)
      .filter(([key, value]) => !knownKeys.has(key) && value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      });
    return extraParts.join(' | ');
  }

  downloadResults(): void {
    if (!this.annotationResult) return;
    
    const dataStr = JSON.stringify(this.annotationResult, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `paper2path-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(link.href);
  }

  isSubmitDisabled(): boolean {
    if (this.isProcessing) return true;
    const hasManualPmids = this.pmidsArray.length > 0 && this.pmidsArray.value.some((pmid: string) => pmid?.trim());
    const hasSelectedPapers = this.preloadedPapers.some(p => p.selected);
    const hasGene = !!(this.configForm.get('targetGene')?.value as string)?.trim();
    return !hasManualPmids && !hasSelectedPapers && !hasGene;
  }

  private showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 7000,
      panelClass: ['error-snackbar']
    });
  }
}