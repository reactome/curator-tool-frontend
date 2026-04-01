import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface HelpSection {
  heading: string;
  items: string[];
}

export interface HelpContext {
  view: string;
  title: string;
  sections: HelpSection[];
}

const HELP_CONTENT: Record<string, HelpContext> = {
  home: {
    view: 'home',
    title: 'Home Page Help',
    sections: [
      {
        heading: 'Navigation',
        items: [
          'Click Schema View to browse classes and edit instances.',
          'Click Event View to work with pathway diagrams and the event tree.',
          'Click Gene2Path to use the LLM gene annotation tool.',
          'Click Tutorial to open the full guided tutorial.',
        ],
      },
      {
        heading: 'Status Toolbar',
        items: [
          'The bottom toolbar shows counts of staged (new, updated, deleted) instances.',
          'Click any count to open the staged-changes panel.',
          'The Default Person button sets the curator identity for new edits.',
          'The Home, Guide, Bug Report, and Log Out icons are always available.',
        ],
      },
    ],
  },
  'schema-view': {
    view: 'schema-view',
    title: 'Schema View Help',
    sections: [
      {
        heading: 'Class Tree (left)',
        items: [
          'Click a class name to view its attribute definitions.',
          'Click the [count] badge to list instances from the database.',
          'Click the (count) badge to list staged/local instances only.',
          'Click the + icon to create a new instance of that class.',
        ],
      },
      {
        heading: 'Instance List',
        items: [
          'Type in the search box and press Enter for a quick search.',
          'Click the filter icon to switch to Advanced Search.',
          'Select rows to enable bulk actions: Delete Selected, Batch Edit, Compare.',
          'Click the Download icon (after a search) to export results as CSV.',
          'Use pagination controls at the bottom to navigate large lists.',
        ],
      },
      {
        heading: 'Instance Editor',
        items: [
          'Click any row to open the instance in the editor.',
          'Edit text fields directly — press Enter to commit, Ctrl+Enter for a new line.',
          'Use the action menu on instance-type slots to set, add, replace, or delete values.',
          'Drag a bookmark onto a compatible slot to set its value.',
          'Click the QA icon to run quality checks on the instance.',
          'Click the Upload icon to commit only this instance.',
        ],
      },
      {
        heading: 'Batch Edit',
        items: [
          'Click the Batch Edit icon in the search bar to open the dialog.',
          'Select an attribute and an action (Add, Replace, Delete) to apply across instances.',
          'If rows are selected, batch edit targets only those; otherwise it applies to the full list scope.',
        ],
      },
    ],
  },
  'event-view': {
    view: 'event-view',
    title: 'Event View Help',
    sections: [
      {
        heading: 'Event Tree (left)',
        items: [
          'Use the species dropdown and text filter to narrow the tree.',
          'Click an event node to load it in the instance editor.',
          'Use the tree action buttons to add an event to the diagram or create a new diagram.',
          'Shift+click the release flag to toggle it for an event and all its children.',
        ],
      },
      {
        heading: 'Pathway Diagram (top right)',
        items: [
          'Selecting from the tree highlights corresponding objects in the diagram.',
          'Clicking diagram objects loads the related instance in the editor.',
          'Right-click the diagram for the context menu: enable editing, add/remove edges, resize, and more.',
          'Upload diagram changes using the Upload option in the diagram context menu.',
        ],
      },
      {
        heading: 'Instance Editor (bottom right)',
        items: [
          'Editing works the same as in Schema View.',
          'Changes are staged locally until committed via the status toolbar.',
        ],
      },
    ],
  },
  'gene2path': {
    view: 'gene2path',
    title: 'Gene2Path Help',
    sections: [
      {
        heading: 'Usage',
        items: [
          'Enter a gene symbol in the input field and click Submit.',
          'Open Settings (gear icon) to change the LLM configuration before submitting.',
          'A progress bar appears while the query runs.',
        ],
      },
      {
        heading: 'Reviewing Results',
        items: [
          'Results include Annotated Pathways, Predicted Pathways, and interaction tables.',
          'Use the side navigation menu to jump between generated sections.',
          'Generated text may include links to Reactome pathways and PubMed citations.',
          'Always review generated content as curation assistance, not ground truth.',
        ],
      },
    ],
  },
  'tutorial': {
    view: 'tutorial',
    title: 'Tutorial Page Help',
    sections: [
      {
        heading: 'Using this page',
        items: [
          'Use the tabs to navigate between sections.',
          'Click "Start Tour" to launch an interactive guided tour for the current view.',
          'The Keyboard Shortcuts tab lists all available keyboard shortcuts.',
        ],
      },
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class HelpContextService {
  private contextSubject = new BehaviorSubject<HelpContext>(HELP_CONTENT['home']);
  context$ = this.contextSubject.asObservable();

  setContext(view: string): void {
    const ctx = HELP_CONTENT[view] ?? HELP_CONTENT['home'];
    this.contextSubject.next(ctx);
  }

  getContext(view: string): HelpContext {
    return HELP_CONTENT[view] ?? HELP_CONTENT['home'];
  }
}
