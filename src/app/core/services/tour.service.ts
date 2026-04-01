import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TourStep {
  id: string;
  title: string;
  content: string;
  /** CSS selector for the element to highlight. Omit for a centered dialog. */
  targetSelector?: string;
  /** Where to render the tooltip relative to the target. Default: 'bottom'. */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
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
    targetSelector: 'app-status',
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
      'The left panel lists all schema classes. Click a class name to see its attributes, click the instance count to list its instances, or click the local count badge to list only staged instances.',
    targetSelector: 'mat-tree, .schema-tree, app-schema-class',
    position: 'right',
  },
  {
    id: 'schema-list',
    title: 'Instance List',
    content:
      'The main panel shows the instance list. Use the search bar for quick text search, or switch to Advanced Search to filter by specific attribute values. Select rows to enable bulk actions like Batch Edit or Delete Selected.',
    targetSelector: 'app-list-instances-view, app-instance-list-view',
    position: 'bottom',
  },
  {
    id: 'schema-batch-edit',
    title: 'Batch Edit',
    content:
      'Click the Batch Edit icon in the search bar to apply attribute changes across many instances at once. You can target selected rows or the entire current page.',
    position: 'center',
  },
  {
    id: 'schema-instance-editor',
    title: 'Instance Editor',
    content:
      'Click any instance row to open the instance editor. You can edit text, numeric, boolean, and instance-type attributes directly. The toolbar provides QA, referrer lookup, diff comparison, and commit controls.',
    position: 'center',
  },
  {
    id: 'schema-staged',
    title: 'Staged Changes',
    content:
      'All edits are staged locally before being committed to the database. Use the status toolbar counters to open the Staged Changes panel and commit, reset, or review your changes in bulk.',
    targetSelector: 'app-status',
    position: 'top',
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
    this.startTour(SCHEMA_TOUR);
  }

  startTour(steps: TourStep[]): void {
    this.stateSubject.next({ active: true, steps, currentIndex: 0 });
  }

  next(): void {
    const s = this.currentState;
    if (!s.active) return;
    if (s.currentIndex < s.steps.length - 1) {
      this.stateSubject.next({ ...s, currentIndex: s.currentIndex + 1 });
    } else {
      this.end();
    }
  }

  prev(): void {
    const s = this.currentState;
    if (!s.active || s.currentIndex <= 0) return;
    this.stateSubject.next({ ...s, currentIndex: s.currentIndex - 1 });
  }

  end(): void {
    this.stateSubject.next({ ...this.initialState });
  }
}
