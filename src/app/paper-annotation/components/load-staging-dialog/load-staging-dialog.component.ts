import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MAX_STAGED_INSTANCES } from 'src/app/core/models/reactome-instance.model';

export interface LoadStagingDialogData {
  /** Items staged right now; they are backed up first and then replaced. */
  staged: number;
  /** New instances in the annotation. */
  incoming: number;
  /** True when the annotation was edited after the instances were last loaded. */
  stale: boolean;
}

@Component({
  selector: 'app-load-staging-dialog',
  templateUrl: './load-staging-dialog.component.html'
})
export class LoadStagingDialogComponent {
  readonly limit = MAX_STAGED_INSTANCES;
  constructor(@Inject(MAT_DIALOG_DATA) public data: LoadStagingDialogData) {}

  get overLimit(): boolean {
    return this.data.incoming > this.limit;
  }
}
