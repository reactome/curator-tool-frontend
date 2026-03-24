import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ReferrersDialogService } from '../referrers-dialog/referrers-dialog.service';
import { Store } from '@ngrx/store';
import { BookmarkActions } from 'src/app/schema-view/instance-bookmark/state/bookmark.actions';

export interface MatchInstancesDialogData {
  title: string;
  instances: Instance[];
}

@Component({
  selector: 'app-match-instances-dialog',
  templateUrl: './match-instances-dialog.component.html',
  styleUrls: ['./match-instances-dialog.component.scss']
})
export class MatchInstancesDialogComponent {
  selectedInstance: Instance | undefined;
  actionButtons = [ACTION_BUTTONS.LAUNCH, ACTION_BUTTONS.LIST, ACTION_BUTTONS.BOOKMARK];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MatchInstancesDialogData,
    private dialogRef: MatDialogRef<MatchInstancesDialogComponent, Instance>,
    private referrersDialogService: ReferrersDialogService,
    private store: Store,
  ) {}

  onSelectRow(row: Instance): void {
    this.selectedInstance = row;
  }

  handleAction(actionEvent: { instance: Instance, action: string }): void {
    switch (actionEvent.action) {
      case ACTION_BUTTONS.LAUNCH.name: {
        const dbId = actionEvent.instance.dbId;
        window.open(`schema_view/instance/${dbId}`, '_matched_instance');
        break;
      }
      case ACTION_BUTTONS.LIST.name: {
        this.referrersDialogService.openDialog(actionEvent.instance);
        break;
      }
      case ACTION_BUTTONS.BOOKMARK.name: {
        this.store.dispatch(BookmarkActions.add_bookmark(actionEvent.instance));
        break;
      }
    }
  }

  onOK(): void {
    this.dialogRef.close(this.selectedInstance);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
