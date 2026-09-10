import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import {
  commonTestProviders,
  componentTestImports,
  makeInstance,
  makeNewInstance,
  provideDialogContext
} from 'src/testing';
import { DeletedObjectCreationDialogComponent } from './deleted-object-creation-dialog.component';

describe('DeletedObjectCreationDialogComponent', () => {
  let component: DeletedObjectCreationDialogComponent;
  let dialogRef: MatDialogRef<DeletedObjectCreationDialogComponent>;
  let dataService: jasmine.SpyObj<DataService>;

  /** Builds the dialog for `data`, with `created` as the Deleted instance the server hands back. */
  function build(data: any, created?: Instance) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        DeletedObjectCreationDialogComponent,
        ...provideDialogContext(data),
        { provide: MAT_DIALOG_DATA, useValue: data }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    dataService.createNewInstance.and.returnValue(
      of(created ?? makeNewInstance({ dbId: -1, schemaClassName: 'Deleted' })));
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(DeletedObjectCreationDialogComponent);
    return component;
  }

  const deletedInstances = [
    makeInstance({ dbId: 300, displayName: 'Old pathway' }),
    makeInstance({ dbId: 100, displayName: 'Older pathway' }),
    makeInstance({ dbId: 200, displayName: 'Middle pathway' })
  ];

  it('creates a Deleted instance to record the commit', () => {
    build(deletedInstances);

    expect(component.selected).toEqual('Deleted');
    expect(dataService.createNewInstance).toHaveBeenCalledWith('Deleted');
  });

  it('records the dbIds of everything being deleted', () => {
    build(deletedInstances);

    expect(component.instance!.attributes.get('deletedInstanceDbId'))
      .toEqual([100, 200, 300]);
  });

  it('sorts the recorded dbIds ascending, so the slot reads predictably', () => {
    build(deletedInstances);

    const recorded = component.instance!.attributes.get('deletedInstanceDbId');
    expect(recorded).toEqual([...recorded].sort((a: number, b: number) => a - b));
  });

  it('gives the new instance an attribute Map when the server sends none', () => {
    // createNewInstance can return a bare instance; setting a slot on it would otherwise throw.
    const bare = { dbId: -1, schemaClassName: 'Deleted', displayName: 'To be generated' } as Instance;

    build(deletedInstances, bare);

    expect(component.instance!.attributes instanceof Map).toBeTrue();
  });

  it('unwraps an instances-property payload as well as a bare array', () => {
    // MAT_DIALOG_DATA is handed an array by some callers and an { instances } object by others.
    build({ instances: deletedInstances });

    expect(component.instance!.attributes.get('deletedInstanceDbId'))
      .toEqual([100, 200, 300]);
  });

  it('records an empty list for an unrecognised payload rather than throwing', () => {
    build(undefined);

    expect(component.instance!.attributes.get('deletedInstanceDbId')).toEqual([]);
  });

  it('closes with the Deleted instance on OK', () => {
    build(deletedInstances).onOK();

    expect(dialogRef.close).toHaveBeenCalledWith(component.instance);
  });

  it('closes with nothing when cancelled, so no Deleted record is committed', () => {
    build(deletedInstances).onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
