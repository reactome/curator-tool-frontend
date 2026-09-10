import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { CreateDeletedDialogService } from '../deleted-object-creation-dialog/deleted-object-creation-dialog.service';
import {
  commonTestProviders,
  componentTestImports,
  makeInstance,
  provideDialogContext
} from 'src/testing';
import { DeletedObjectCreationOptionDialogComponent } from './deleted-object-creation-option-dialog.component';

describe('DeletedObjectCreationOptionDialogComponent', () => {
  let component: DeletedObjectCreationOptionDialogComponent;
  let dialogRef: MatDialogRef<DeletedObjectCreationOptionDialogComponent>;

  const instances: Instance[] = [
    makeInstance({ dbId: 100, displayName: 'Glycolysis' }),
    makeInstance({ dbId: 101, displayName: 'A -> B', schemaClassName: 'Reaction' })
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        DeletedObjectCreationOptionDialogComponent,
        ...provideDialogContext(instances),
        { provide: MAT_DIALOG_DATA, useValue: instances },
        {
          provide: CreateDeletedDialogService,
          useValue: jasmine.createSpyObj<CreateDeletedDialogService>(
            'CreateDeletedDialogService', ['openDialog'])
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(DeletedObjectCreationOptionDialogComponent);
  });

  it('takes the instances awaiting a deletion commit from the dialog data', () => {
    expect(component.instances).toBe(instances);
  });

  it('closes with true when the curator opts to record Deleted objects', () => {
    // The boolean is the whole answer this dialog exists to collect, so the caller can
    // decide whether to go on and create the Deleted records.
    component.onDeleteByDeleted();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('closes with false when cancelled, rather than with nothing', () => {
    // Closing with undefined would be indistinguishable from a backdrop click for a caller
    // that only checks truthiness, but the explicit false keeps the two paths symmetric.
    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
