import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { CreateDeletedDialogService } from 'src/app/instance/deletion-commit/components/deleted-object-creation-dialog/deleted-object-creation-dialog.service';
import { ConfirmDeleteDialogComponent } from 'src/app/instance/components/deletion-dialog/confirm-delete-dialog/confirm-delete-dialog.component';
import { DeleteInstanceActions, UpdateInstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';

@Component({
  selector: 'app-deleted-object-creation-option-dialog',
  templateUrl: './deleted-object-creation-option-dialog.component.html',
  styleUrls: ['./deleted-object-creation-option-dialog.component.scss']
})
export class DeletedObjectCreationOptionDialogComponent {
    constructor(@Inject(MAT_DIALOG_DATA) public instances: Array<Instance>,
                public dialogRef: MatDialogRef<DeletedObjectCreationOptionDialogComponent>,
                public dataService: DataService,
                private createDeletedDialogService: CreateDeletedDialogService) {
    }
  
    onCancel() {
      this.dialogRef.close(false);
    }
  
    onDeleteByDeleted() {
      this.dialogRef.close(true);
    }

}
