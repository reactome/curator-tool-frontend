import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ReactionImbalanceDialogComponent } from './reaction-imbalance-dialog.component';

/** Schema classes the reaction imbalance check accepts: every Reaction under a Pathway, or one Reaction. */
export const REACTION_IMBALANCE_CLASSES = ['Pathway', 'TopLevelPathway', 'Reaction'];

@Injectable({
  providedIn: 'root'
})
export class ReactionImbalanceDialogService {

  constructor(private dialog: MatDialog) { }

  canCheck(schemaClassName: string | undefined, dbId: number | undefined): boolean {
    return !!schemaClassName && REACTION_IMBALANCE_CLASSES.includes(schemaClassName)
      && dbId !== undefined && dbId > 0;
  }

  /** The dialog runs the check itself and shows a spinner until the report arrives. */
  openDialog(dbId: number, displayName?: string): MatDialogRef<ReactionImbalanceDialogComponent> {
    return this.dialog.open(ReactionImbalanceDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      data: { dbId, displayName },
    });
  }
}
