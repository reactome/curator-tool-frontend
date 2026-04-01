import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TourService } from '../../../core/services/tour.service';

@Component({
  selector: 'app-tutorial-page',
  templateUrl: './tutorial-page.component.html',
  styleUrls: ['./tutorial-page.component.scss'],
})
export class TutorialPageComponent {
  /* ── Batch-edit actions table ─────────────────────────── */
  batchEditActions = [
    { type: 'Instance', cardinality: 'Single', actions: 'Set via Creation, Set via Selection, Delete' },
    { type: 'Instance', cardinality: 'Multi', actions: 'Add via Creation, Add via Selection, Replace via Creation, Replace via Selection, Delete' },
    { type: 'Text', cardinality: 'Single', actions: 'Replace Text, Delete' },
    { type: 'Text', cardinality: 'Multi', actions: 'Add New Text, Replace Text, Delete' },
    { type: 'Boolean', cardinality: 'Any', actions: 'Set True / Set False' },
  ];

  /* ── Keyboard shortcuts ───────────────────────────────── */
  shortcutsEditing = [
    { shortcut: 'Enter', context: 'Text / Number field', action: 'Commit the current edit' },
    { shortcut: 'Ctrl+Enter / ⌘+Enter', context: 'Text field (textarea)', action: 'Insert newline at cursor' },
  ];

  shortcutsTour = [
    { shortcut: '→ Arrow Right', action: 'Next tour step' },
    { shortcut: '← Arrow Left', action: 'Previous tour step' },
    { shortcut: 'Escape', action: 'End the tour' },
  ];

  shortcutsSearch = [
    { shortcut: 'Enter', context: 'Simple search box', action: 'Run the search' },
    { shortcut: 'Enter', context: 'Event tree filter', action: 'Apply event name / dbId filter' },
    { shortcut: 'Shift+Click', context: 'Event tree release flag', action: 'Toggle release flag for event + all children' },
  ];

  /* ── Common workflows ─────────────────────────────────── */
  workflows = [
    {
      title: 'Create and commit a new instance',
      steps: [
        'Go to Schema View.',
        'In the class tree, click the + icon next to the desired class.',
        'Edit attributes in the instance editor.',
        'Click the Upload icon in the instance toolbar to commit just this instance, or open the staged-changes panel to commit in bulk.',
      ],
    },
    {
      title: 'Edit existing instances and review diffs',
      steps: [
        'Open the class instance list.',
        'Click a row to open the instance editor and edit values.',
        'Use the Compare icon in the toolbar to see a side-by-side diff against the database version.',
        'Open the Staged Panel from the status toolbar, select Updated Instances, and commit or reset.',
      ],
    },
    {
      title: 'Delete an instance safely',
      steps: [
        'Open the instance from the list.',
        'Click the Delete icon in the instance toolbar.',
        'Review the deletion dialog — it shows referrers that will be affected.',
        'Confirm deletion to stage it.',
        'Open the Staged Changes panel, select the instance in Deleted Instances, and commit.',
      ],
    },
    {
      title: 'Batch-edit an attribute across many instances',
      steps: [
        'Navigate to the class instance list.',
        'Optionally select specific rows you want to target.',
        'Click the Batch Edit icon in the search bar.',
        'Choose the attribute, action, and value, then confirm.',
        'Review the staged updates in the Updated Instances panel and commit.',
      ],
    },
    {
      title: 'Work in Event View with diagram and editor',
      steps: [
        'Open Event View.',
        'Use the species filter and text filter to find the event.',
        'Click the event to load it in the lower instance editor.',
        'Click the diagram action icon to add the event to the diagram.',
        'Select diagram objects to load related instances in the editor.',
        'Right-click the diagram to enable editing and make diagram changes.',
        'Upload diagram changes, then commit staged instance changes via the status toolbar.',
      ],
    },
    {
      title: 'Use bookmarks for fast instance assignment',
      steps: [
        'Open an instance you want to use as a reference value.',
        'Click the Bookmark icon in the instance toolbar to add it to the bookmarks strip.',
        'Navigate to the target instance.',
        'Drag the bookmarked instance from the right-side strip onto the compatible attribute slot.',
      ],
    },
  ];

  constructor(
    private tourService: TourService,
    private router: Router,
  ) {}

  startHomeTour(): void {
    this.tourService.startHomeTour();
    this.router.navigate(['/home']);
  }

  startSchemaTour(): void {
    this.tourService.startSchemaTour();
    this.router.navigate(['/schema_view']);
  }
}
