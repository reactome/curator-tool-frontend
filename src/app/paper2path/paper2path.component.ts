import { AfterViewChecked, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, Subscription, takeUntil, interval, forkJoin, firstValueFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { NewInstanceActions, UpdateInstanceActions } from 'src/app/instance/state/instance.actions';
import { DataService } from 'src/app/core/services/data.service';
import { PostEditService } from 'src/app/core/services/post-edit.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { PostEditListener } from 'src/app/core/post-edit/PostEditOperation';
import {
  AnnotationJobStatus,
  CrewAIDashboardConfig,
  CrewAILogEntry,
  PreloadedPaper,
  Paper2pathService
} from 'src/app/paper2path/services/paper2path.service';
import { environment } from 'src/environments/environment.dev';

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
  private tokenKeepAliveSub: Subscription | null = null;
  private pendingLogScroll = false;
  private readonly AUTH_REFRESH_URL = `${environment.authURL}/refresh`;
  
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
  formattedAnnotationResult = '';
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
    private http: HttpClient,
    private paper2pathService: Paper2pathService,
    private snackBar: MatSnackBar,
    private store: Store,
    private dataService: DataService,
    private postEditService: PostEditService,
    private instanceUtilities: InstanceUtilities
  ) {
    this.initializeForms();
    this.loadMockAnnotationResult();
  }

  ngOnDestroy() {
    this.stopPolling();
    this.stopTokenKeepAlive();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private startTokenKeepAlive(): void {
    if (this.tokenKeepAliveSub) return;
    this.tokenKeepAliveSub = interval(60_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.http.post<any>(this.AUTH_REFRESH_URL, {}, { withCredentials: true }).subscribe({
          next: (resp: any) => {
            const token = typeof resp === 'string' ? resp : (resp?.token || resp?.accessToken || resp?.jwt);
            if (token) {
              localStorage.setItem('token', token);
            }
          },
          error: () => {
            // Do not interrupt annotation flow; existing auth handling covers hard failures.
          }
        });
      });
  }

  private stopTokenKeepAlive(): void {
    this.tokenKeepAliveSub?.unsubscribe();
    this.tokenKeepAliveSub = null;
  }

  ngAfterViewChecked() {
    if (this.pendingLogScroll) {
      this.scrollLogsToBottom();
    }
  }

  private loadMockAnnotationResult() {
    this.paper2pathService.getMockAnnotationResult().subscribe({
      next: (result: any) => {
        this.setAnnotationResult(result);
      },
      error: (err: Error) => {
        console.warn('Could not load mock annotation result:', err.message);
      }
    });
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
        this.startTokenKeepAlive();
        this.currentJob = job;
        this.selectedTab = 2;
        this.startPollingForResult();
        this.showSuccess(`Annotation job submitted: ${job.job_id}`);
      },
      error: (err: Error) => {
        this.showError(`Failed to submit annotation: ${err.message}`);
        this.isProcessing = false;
        this.stopTokenKeepAlive();
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
              this.setAnnotationResult(status.result);
              this.isProcessing = false;
              this.stopPolling();
              this.stopTokenKeepAlive();
              this.showSuccess('Annotation completed successfully!');
            } else if (status.status === 'error') {
              this.error = status.error || 'Unknown error occurred';
              this.isProcessing = false;
              this.stopPolling();
              this.stopTokenKeepAlive();
              this.showError(`Annotation failed: ${this.error}`);
            } else if (status.status === 'not_found') {
              this.error = 'Annotation job not found on server.';
              this.isProcessing = false;
              this.stopPolling();
              this.stopTokenKeepAlive();
              this.showError(this.error);
            }
            // 'running' — continue polling on next tick
          },
          error: (err: Error) => {
            this.error = `Failed to get job status: ${err.message}`;
            this.isProcessing = false;
            this.stopPolling();
            this.stopTokenKeepAlive();
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

  async pushInstancesToStore() {
    if (!this.annotationResult?.reactome_instances?.length) return;

    let count = 0;

    for (const item of this.annotationResult.reactome_instances) {
      let content: any;
      try { content = JSON.parse(item.content); } catch { continue; }

      const entities  = content.entities  || [];
      const reactions = content.reactions || [];
      const pathways  = content.pathways  || [];

      // Label → registered Instance shell for cross-referencing
      const labelToInst = new Map<string, Instance>();
      const shell = (inst: Instance): Instance =>
        ({ dbId: inst.dbId, schemaClassName: inst.schemaClassName, displayName: inst.displayName });

      // 0. Collect all unique PMIDs across reactions and pathways, create LiteratureReference instances
      const pmidToLitRef = new Map<string, Instance>();
      const allItems = [...(content.reactions || []), ...(content.pathways || [])];
      const allPmids = new Set<string>(allItems.flatMap((r: any) => r.literatureReference || []));
      for (const pmid of allPmids) {
        const litRef = await this.createAndRegisterInstance('LiteratureReference', pmid, {
          pubMedIdentifier: pmid
        });
        count++;
        litRef.attributes.set('pubMedIdentifier', parseInt(pmid, 10));
        pmidToLitRef.set(pmid, litRef);
        // Trigger server-side auto-fill (title, journal, authors, etc.) via the post-edit pipeline
        await this.waitForPostEditCompletion(litRef, 'pubMedIdentifier');
        // Notify store + view to refresh all attributes (displayName, title, journal, authors, etc.)
        this.instanceUtilities.registerUpdatedInstance('pubMedIdentifier', litRef);
        // Need to get the total Person instances that are created (i.e. with negative dbIds here)
        const personCount = Array.from(litRef.attributes.get('author') || [])
          .filter((a: unknown) => {
            const author = a as Instance;
            return author.schemaClassName === 'Person' && (author.dbId ?? -1) < 0;
          })
          .length;
        count += personCount;
      }

      // 1. Register entity instances and build label index
      for (const raw of entities) {
        const inst = await this.createAndRegisterInstance(
          raw.class || 'EntityWithAccessionedSequence',
          raw.displayName,
          {
            identifier: raw.identifier,
            species: raw.species,
            referenceEntity: raw.referenceEntity
          }
        );
        count++;

        // Index by identifier suffix (e.g. "UniProt_TANC1" → "TANC1") and by displayName
        if (raw.identifier) {
          const shortId = raw.identifier.includes('_') ? raw.identifier.split('_').slice(1).join('_') : raw.identifier;
          labelToInst.set(shortId, inst);
          labelToInst.set(raw.identifier, inst);
        }
        if (raw.displayName) { labelToInst.set(raw.displayName, inst); }
      }

      // 2. Pre-register output complexes/bindings not defined as standalone entities
      const outputLabels = new Set<string>(reactions.flatMap((r: any) => r.output || []));
      for (const label of outputLabels) {
        if (!labelToInst.has(label)) {
          const outputInst = await this.createAndRegisterInstance('Complex', label);
          count++;
          labelToInst.set(label, outputInst);
        }
      }

      // 3. Register reaction instances with input/output attributes
      for (const [index, raw] of reactions.entries()) {
        const inputShells  = (raw.input  || []).map((l: string) => labelToInst.get(l)).filter(Boolean).map(shell);
        const outputShells = (raw.output || []).map((l: string) => labelToInst.get(l)).filter(Boolean).map(shell);

        const litRefShells = (raw.literatureReference || []).map((p: string) => pmidToLitRef.get(p)).filter(Boolean).map(shell);
        const inst = await this.createAndRegisterInstance(
          raw.class || 'Reaction',
          raw.displayName,
          {
            input: inputShells,
            output: outputShells,
            literatureReference: litRefShells,
            catalystActivity: raw.catalystActivity,
            inferredFrom: raw.inferredFrom
          }
        );
        count++;

        // Index positionally so pathways can reference as "Reaction1", "Reaction2", …
        labelToInst.set(`Reaction${index + 1}`, inst);
        if (raw.displayName) { labelToInst.set(raw.displayName, inst); }
      }

      // 4. Register pathway instances with hasEvent attribute
      for (const raw of pathways) {
        const eventShells = (raw.hasEvent || []).map((l: string) => labelToInst.get(l)).filter(Boolean).map(shell);

        const pathwayLitRefShells = (raw.literatureReference || []).map((p: string) => pmidToLitRef.get(p)).filter(Boolean).map(shell);
        await this.createAndRegisterInstance(
          raw.class || 'Pathway',
          raw.displayName,
          {
            hasEvent: eventShells,
            literatureReference: pathwayLitRefShells,
            summation: raw.summation
          }
        );
        count++;
      }
    }

    this.instancesPushed = true;
    this.showSuccess(`${count} instance${count !== 1 ? 's' : ''} added to schema view.`);
    window.open('schema_view', '_blank');
  }

  private async createAndRegisterInstance(
    schemaClassName: string,
    displayName?: string,
    attributes?: Record<string, any>
  ): Promise<Instance> {
    const instance = await firstValueFrom(this.dataService.createNewInstance(schemaClassName));
    if (!(instance.attributes instanceof Map)) {
      instance.attributes = new Map<string, any>(Object.entries(instance.attributes || {}));
    }
    if (displayName) {
      instance.displayName = displayName;
      instance.attributes.set('displayName', displayName);
    }
    if (attributes) {
      Object.entries(attributes)
        .filter(([, value]) => value !== undefined)
        .forEach(([key, value]) => instance.attributes.set(key, value));
    }
    this.dataService.registerInstance(instance);
    this.store.dispatch(NewInstanceActions.register_new_instance(this.instanceUtilities.makeShell(instance)));
    return instance;
  }

  private waitForPostEditCompletion(instance: Instance, editedAttributeName: string): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.warn(`Post-edit timed out for ${instance.schemaClassName}:${instance.dbId}`);
        resolve();
      }, 30000);

      const listener: PostEditListener = {
        donePostEdit: () => {
          if (settled) return true;
          settled = true;
          clearTimeout(timeoutId);
          resolve();
          return true;
        }
      };

      this.postEditService.postEdit(instance, editedAttributeName, listener);
    });
  }

  resetAnnotation() {
    this.stopPolling();
    this.stopTokenKeepAlive();
    this.currentJob = null;
    this.setAnnotationResult(null);
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

  private setAnnotationResult(result: any) {
    this.annotationResult = result;
    this.formattedAnnotationResult = result
      ? JSON.stringify(this.parseEmbeddedJson(result), null, 2)
      : '';
  }

  private parseEmbeddedJson(value: any): any {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          return this.parseEmbeddedJson(JSON.parse(trimmed));
        } catch {
          return value;
        }
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.parseEmbeddedJson(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, this.parseEmbeddedJson(child)])
      );
    }

    return value;
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
      panelClass: ['error-snackbar']
    });
  }
}