import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { BatchEditDialogService } from 'src/app/schema-view/list-instances/components/list-instances-view/batch-edit-dialog/batch-edit-dialog-service';
import { BatchEditDialogComponent } from 'src/app/schema-view/list-instances/components/list-instances-view/batch-edit-dialog/batch-edit-dialog.component';
import { DataService } from './data.service';
import { InstanceUtilities } from './instance.service';

export interface TourStep {
  id: string;
  title: string;
  content: string;
  /** CSS selector for the element to highlight. Omit for a centered dialog. */
  targetSelector?: string;
  /** Where to render the tooltip relative to the target. Default: 'bottom'. */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Called when the tour enters this step. */
  onEnter?: () => void;
  /** Called when the tour leaves this step (next, prev, or end). */
  onLeave?: () => void;
}

export interface TourState {
  active: boolean;
  steps: TourStep[];
  currentIndex: number;
}

const HOME_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Reactome Curation WebBench',
    content:
      'This short tour shows you the key areas of the application. Use the Next button or press the right arrow key to continue. Press Escape to end at any time.',
    position: 'center',
  },
  {
    id: 'schema-view',
    title: 'Schema View',
    content:
      'Browse schema classes, list and search instances, edit attributes, and manage your staged changes. This is the main curation workspace.',
    targetSelector: '[routerLink="/schema_view"], a[href*="schema_view"]',
    position: 'bottom',
  },
  {
    id: 'event-view',
    title: 'Event View',
    content:
      'Work with the event tree, pathway diagram, and instance editor all in one layout. Select events in the tree to load them in the diagram and editor panels.',
    targetSelector: '[routerLink="/event_view"], a[href*="event_view"]',
    position: 'bottom',
  },
  {
    id: 'gene2path',
    title: 'Gene2Path',
    content:
      'Enter a gene symbol to generate LLM-assisted pathway annotation support. Useful for reviewing predicted pathway associations before curating.',
    targetSelector: '[routerLink="/gene2path"], a[href*="gene2path"]',
    position: 'bottom',
  },
  {
    id: 'paper2path',
    title: 'Paper2Path',
    content:
      'Use Paper2Path to run a multi-agent literature annotation workflow from PMIDs, PDFs, and/or a target gene, then register generated instances into Schema View for review.',
    targetSelector: '[routerLink="/paper2path"], a[href*="paper2path"]',
    position: 'bottom',
  },
  {
    id: 'tutorial-card',
    title: 'Tutorial',
    content:
      'Open the full Tutorial page at any time for a comprehensive reference covering all features, keyboard shortcuts, and common workflows.',
    targetSelector: '[routerLink="/tutorial"], a[href*="tutorial"]',
    position: 'bottom',
  },
  {
    id: 'status-bar',
    title: 'Status Toolbar',
    content:
      'The toolbar at the bottom shows your staged changes (new, updated, deleted instances). Click any counter to open the staged-changes panel and commit or undo your work.',
    targetSelector: 'app-status mat-toolbar',
    position: 'top',
  },
];

const SCHEMA_TOUR: TourStep[] = [
  {
    id: 'schema-welcome',
    title: 'Schema View Tour',
    content:
      'Welcome to Schema View. This tour walks you through the main panels and tools available here.',
    position: 'center',
  },
  {
    id: 'schema-tree',
    title: 'Class Tree',
    content:
      'The left panel lists all schema classes. Click a class name to see its attributes, click the instance count to list its instances, or click the local count badge to list only staged instances. The "+ New" icon creates a new instance of that class.',
    targetSelector: 'mat-tree, .schema-tree, app-schema-class',
    position: 'right',
  },
  {
    id: 'schema-list',
    title: 'Instance List',
    content:
      'The main panel shows the instance list. Use the search bar for quick text search, or switch to Advanced Search by using the manage_search icon in the search bar to filter by specific attribute values. Select rows to enable bulk actions like Batch Edit or Delete Selected. Hover over action buttons for tooltips explaining their functions.',
    targetSelector: 'app-list-instances-view, app-instance-list-view',
    position: 'bottom',
  },
  {
    id: 'schema-batch-edit',
    title: 'Batch Edit',
    content:
      'Click the Batch Edit icon in the search bar to apply attribute changes across many instances at once. You can target selected rows or the entire current page.',
    targetSelector: '#batch-edit-tour-target',
    position: 'bottom',
  },
  {
    id: 'schema-instance-editor',
    title: 'Instance Editor',
    content:
      'Click any instance row to open the instance editor. You can edit text, numeric, boolean, and instance-type attributes directly. The toolbar provides QA, referrer lookup, diff comparison, and commit controls. Right click instance-type values to open a context menu for creating, selecting, deleting or replacing linked instances. The attribute column shows the name of each attribute for the selected instance, and hovering over an attribute displays additional information such as its type and description. Sort attributes alphabetically, by defined attributes, and sort by category by hovering over the column headers in the table.',
    targetSelector: 'app-instance-table',
    position: 'left',
  },
    {
    id: 'schema-bookmarks',
    title: 'Bookmarks Strip',
    content:
      'The right edge strip holds your bookmarked instances. Expand or collapse it by clicking the BOOKMARKS label. Drag a bookmarked instance onto a compatible attribute slot in the editor to assign it as a value.',
    targetSelector: 'app-bookmark-list',
    position: 'left',
  },
  {
    id: 'schema-staged',
    title: 'Staged Changes',
    content:
      'All edits are staged locally before being committed to the database. Use the status toolbar counters to open the Staged Changes panel and commit, reset, or review your changes in bulk.',
    targetSelector: 'app-status mat-toolbar',
    position: 'top',
  },
];

const EVENT_VIEW_TOUR: TourStep[] = [
  {
    id: 'event-welcome',
    title: 'Event View Tour',
    content:
      'Welcome to Event View. This tour covers the event tree, pathway diagram, and instance editor panels.',
    position: 'center',
  },
  {
    id: 'event-filter',
    title: 'Species & Event Filter',
    content:
      'Use the species dropdown at the top of the left panel to filter events by species. Type in the text filter and press Enter to search by event name or dbId.',
    targetSelector: '#event-filter-tour-target',
    position: 'right',
  },
  {
    id: 'event-tree',
    title: 'Event Tree',
    content:
      'The tree lists all events hierarchically. Expand nodes with the arrow. Click an event to load it in the instance editor. Use the action icons to add an event to the diagram, create a new diagram, or toggle the release flag. Shift+click the release flag to apply it to an entire subtree.',
    targetSelector: 'app-event-tree, .event-tree, mat-tree',
    position: 'right',
  },
  {
    id: 'event-diagram',
    title: 'Pathway Diagram',
    content:
      'The upper-right panel shows the pathway diagram. Selecting an event in the tree highlights its objects here. Click a diagram object to load the related instance in the editor below. Right-click an object to open a specific context menu for editing, alignment, and upload actions.',
    targetSelector: 'app-pathway-diagram',
    position: 'left',
  },
  {
    id: 'event-instance-editor',
    title: 'Instance Editor',
    content:
      'The lower-right panel is the instance editor — the same editor used in Schema View. Edit attribute values directly, use the toolbar for QA, referrers, compare, and upload.',
    targetSelector: 'app-instance-view, .instance-view',
    position: 'left',
  },
  {
    id: 'event-staged',
    title: 'Staged Changes',
    content:
      'The status toolbar at the bottom works the same as in Schema View. Click any staged-count button to switch the left panel to the staged-changes list where you can commit or reset your work.',
    targetSelector: 'app-status mat-toolbar',
    position: 'top',
  },
];

const GENE2PATH_TOUR: TourStep[] = [
  {
    id: 'gene2path-welcome',
    title: 'Gene2Path App Tour',
    content:
      'Welcome to Gene2Path. This tool uses an LLM service to generate pathway annotation support for a gene. This tour walks you through submitting a query and reviewing results.',
    position: 'center',
  },
  {
    id: 'gene2path-input',
    title: 'Gene Symbol Input',
    content:
      'Type a gene symbol into the input field. A default example gene is pre-filled to get you started quickly.',
    targetSelector: 'mat-form-field input, .gene-input',
    position: 'bottom',
  },
  {
    id: 'gene2path-settings',
    title: 'Settings',
    content:
      'Click the gear icon to open the Settings panel before submitting. Here you can change LLM model configuration options.',
    position: 'center',
  },
  {
    id: 'gene2path-submit',
    title: 'Submit',
    content:
      'Click the Submit (publish) icon to run the query. A progress bar appears while the LLM processes the gene against Reactome pathway data.',
    position: 'center',
  },
  {
    id: 'gene2path-results',
    title: 'Results',
    content:
      'Results are grouped into: Annotated Pathways (confirmed associations), Predicted Pathways (LLM suggestions to review), and protein-protein interaction tables. Use the side navigation menu to jump between sections.',
    position: 'center',
  },
  {
    id: 'gene2path-caution',
    title: 'Review Before Curating',
    content:
      'Generated content is curation assistance — not ground truth. Always review pathway links and PubMed citations before adding data to Reactome.',
    position: 'center',
  },
];

const PAPER2PATH_TOUR: TourStep[] = [
  {
    id: 'paper2path-welcome',
    title: 'Paper2Path App Tour',
    content:
      'Welcome to Paper2Path. This tool runs a multi-agent literature annotation workflow and can register generated entities, reactions, and pathways into Schema View.',
    position: 'center',
  },
  {
    id: 'paper2path-banner',
    title: 'Header and Configuration',
    content:
      'Use the Configure button in the header to open annotation settings, including max papers, quality threshold, and dashboard toggles for phases, agents, and tools.',
    targetSelector: '.app-banner',
    position: 'bottom',
  },
  {
    id: 'paper2path-gene',
    title: 'Target Gene Input',
    content:
      'Provide a target gene symbol (for example TP53 or BRCA1). You can run annotation from a gene only, papers only, or both together.',
    targetSelector: '.gene-bar',
    position: 'bottom',
  },
  {
    id: 'paper2path-papers',
    title: 'Paper Sources',
    content:
      'Use Enter Papers to provide PMIDs or upload a PDF. Use Preloaded Papers to select documents already available on the server.',
    targetSelector: '.paper-tabs',
    position: 'bottom',
  },
  {
    id: 'paper2path-submit',
    title: 'Run Annotation',
    content:
      'Click Start Annotation to submit a job. Runtime logs and phase progress appear in the Results tab while the CrewAI pipeline executes.',
    targetSelector: '.section-footer',
    position: 'top',
  },
  {
    id: 'paper2path-results',
    title: 'Review and Register Results',
    content:
      'After completion, review the JSON output, download results, then click Add to Schema View to create and stage new instances for curation.',
    targetSelector: '.paper-tabs',
    position: 'top',
  },
  {
    id: 'paper2path-caution',
    title: 'Curation Reminder',
    content:
      'Paper2Path output is assistant-generated content. Always review evidence and instance relationships before committing staged changes.',
    position: 'center',
  },
];

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly initialState: TourState = {
    active: false,
    steps: [],
    currentIndex: 0,
  };

  private stateSubject = new BehaviorSubject<TourState>({ ...this.initialState });
  state$ = this.stateSubject.asObservable();

  private stepDialogRef: MatDialogRef<BatchEditDialogComponent> | null = null;

  constructor(
    private batchEditDialogService: BatchEditDialogService,
    private router: Router,
    private dataService: DataService,
    private overlayContainer: OverlayContainer,
    private instanceUtilities: InstanceUtilities,
  ) { }

  get currentState(): TourState {
    return this.stateSubject.getValue();
  }

  get currentStep(): TourStep | null {
    const s = this.currentState;
    return s.active && s.steps.length > 0 ? s.steps[s.currentIndex] : null;
  }

  startHomeTour(): void {
    this.startTour(HOME_TOUR);
  }

  startSchemaTour(): void {
    const steps = SCHEMA_TOUR.map(step => {
      if (step.id === 'schema-batch-edit') {
        return {
          ...step,
          onEnter: () => {
            this.dataService.listInstances('Event', 0, 5, undefined).subscribe(result => {
              this.overlayContainer.getContainerElement().style.zIndex = '1200';
              this.stepDialogRef = this.batchEditDialogService.openDialog(result.instances);
            });
          },
          onLeave: () => {
            this.stepDialogRef?.close();
            this.stepDialogRef = null;
            this.overlayContainer.getContainerElement().style.zIndex = '';
          },
        };
      }
      if (step.id === 'schema-instance-editor') {
        return {
          ...step,
          onEnter: () => {
            this.router.navigate(['/schema_view/instance/9928344']);
          },
        };
      }
      return step;
    });
    this.startTour(steps);
  }

  startEventViewTour(): void {
    const steps = EVENT_VIEW_TOUR.map(step => {
      if (step.id === 'event-welcome') {
        return {
          ...step,
          onEnter: () => {
            this.router.navigate(['/event_view/instance/5693567']).then(() => {
              setTimeout(() => {
                this.instanceUtilities.setLastClickedDbId(5693567);
              }, 400);
            });
          },
        };
      }
      if (step.id === 'event-instance-editor') {
        return {
          ...step,
          onEnter: () => {
            this.instanceUtilities.setLastClickedDbId(5693567);
          },
        };
      }
      return step;
    });
    this.startTour(steps);
  }

  startGene2PathTour(): void {
    this.startTour(GENE2PATH_TOUR);
  }

  startPaper2PathTour(): void {
    this.startTour(PAPER2PATH_TOUR);
  }

  startTour(steps: TourStep[]): void {
    this.stateSubject.next({ active: true, steps, currentIndex: 0 });
    steps[0]?.onEnter?.();
  }

  next(): void {
    const s = this.currentState;
    if (!s.active) return;
    s.steps[s.currentIndex]?.onLeave?.();
    if (s.currentIndex < s.steps.length - 1) {
      this.stateSubject.next({ ...s, currentIndex: s.currentIndex + 1 });
      s.steps[s.currentIndex + 1]?.onEnter?.();
    } else {
      this.end();
    }
  }

  prev(): void {
    const s = this.currentState;
    if (!s.active || s.currentIndex <= 0) return;
    s.steps[s.currentIndex]?.onLeave?.();
    this.stateSubject.next({ ...s, currentIndex: s.currentIndex - 1 });
    s.steps[s.currentIndex - 1]?.onEnter?.();
  }

  end(): void {
    const s = this.currentState;
    s.steps[s.currentIndex]?.onLeave?.();
    this.stateSubject.next({ ...this.initialState });
  }
}
