import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MAX_STAGED_INSTANCES } from 'src/app/core/models/reactome-instance.model';
import { ReferenceReport } from '../../services/reference-preparer.service';

export interface LoadStagingDialogData {
  /** Items that will be replaced (everything staged except a default person that is kept); they are backed up first. */
  staged: number;
  /** True when the curator's staged default person is kept through the load. */
  keepsDefaultPerson: boolean;
  /** How many of the curator's bookmarks are kept through the load. */
  keepsBookmarks: number;
  /** New instances in the annotation. */
  incoming: number;
  /** True when the annotation was edited after the instances were last loaded. */
  stale: boolean;
  /** How many reactions the curator checked to load, and how many the annotation has. */
  reactions?: number;
  totalReactions?: number;
  /** True when every reaction is checked, so the annotation's pathway comes too. */
  pathway?: boolean;
  /** What was done with the cited papers. */
  references?: ReferenceReport;
}

@Component({
  selector: 'app-load-staging-dialog',
  templateUrl: './load-staging-dialog.component.html'
})
export class LoadStagingDialogComponent {
  readonly limit = MAX_STAGED_INSTANCES;
  constructor(@Inject(MAT_DIALOG_DATA) public data: LoadStagingDialogData) {}

  /** "default person", "2 bookmarks", or "default person and 2 bookmarks"; empty when nothing is kept. */
  get kept(): string {
    const n = this.data.keepsBookmarks;
    return [this.data.keepsDefaultPerson ? 'default person' : '', n ? `${n} bookmark${n === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
  }

  /** "PMID 1, PMID 2" */
  pmids(list: string[]): string {
    return list.map(p => 'PMID ' + p).join(', ');
  }

  get overLimit(): boolean {
    return this.data.incoming > this.limit;
  }
}
