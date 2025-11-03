import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeletedObjectCreationDialogComponent } from './components/deleted-object-creation-dialog/deleted-object-creation-dialog.component';
import { DeletedObjectCreationOptionDialogComponent } from './components/deleted-object-creation-option-dialog/deleted-object-creation-option-dialog.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { MaterialModule } from 'src/app/shared/material/material.module';
import { InstanceModule } from '../instance.module';
import { MatDialog, MatDialogTitle } from '@angular/material/dialog';



@NgModule({
  declarations: [
    DeletedObjectCreationDialogComponent,
    DeletedObjectCreationOptionDialogComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    MaterialModule,
    InstanceModule,
    MatDialogTitle
  ]
})
export class DeletionCommitModule { }
