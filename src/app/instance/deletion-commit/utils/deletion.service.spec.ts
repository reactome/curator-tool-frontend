import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { Instance, NEW_DISPLAY_NAME } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { DeleteBulkDialogService } from 'src/app/schema-view/list-instances/components/delete-bulk-dialog/delete-bulk-dialog.service';
import { CommitResultDialogService } from 'src/app/status/components/local-instance-list/commit-result-dialog/commit-result-dialog.service';
import { CreateDeletedDialogService } from '../components/deleted-object-creation-dialog/deleted-object-creation-dialog.service';
import { CommitDeletedDialogService } from '../components/deleted-object-creation-option-dialog/deleted-object-creation-option-dialog.service';
import { DeletionService } from './deletion.service';

/**
 * Committing a deletion as a Deleted instance. The dialog assembles that instance by setting
 * deletedInstanceDbId directly, so the post-edit pipeline - which is what generates display names
 * - never runs for it, and it used to be committed still carrying the "To be generated"
 * placeholder it was created with. Six Deleted instances in the curation database are named that
 * way.
 */
describe('DeletionService, the Deleted instance display name', () => {
  let service: DeletionService;
  let dataService: jasmine.SpyObj<DataService>;
  let deletedObject: Instance;

  /** What the creation dialog hands back: a new Deleted instance, named only by the placeholder. */
  function newDeletedObject(deletedInstanceDbIds: number[]): Instance {
    return {
      dbId: -1,
      displayName: NEW_DISPLAY_NAME,
      schemaClassName: 'Deleted',
      attributes: new Map<string, any>([['deletedInstanceDbId', deletedInstanceDbIds]]),
    };
  }

  function setUp(deletedInstanceDbIds: number[]) {
    deletedObject = newDeletedObject(deletedInstanceDbIds);

    dataService = jasmine.createSpyObj<DataService>('DataService',
      ['synchronizeDeletedReferrers', 'deleteByDeleted', 'flagSchemaTreeForReload', 'getSchemaClass']);
    dataService.synchronizeDeletedReferrers.and.returnValue(of([]));
    dataService.deleteByDeleted.and.returnValue(of(true));

    const utils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities',
      ['makeShell', 'setDeletedDbId', 'isSchemaClass', 'addToModifiedAttributes', 'registerDisplayNameChange']);
    utils.makeShell.and.callFake((inst: Instance) =>
      ({ dbId: inst.dbId, schemaClassName: inst.schemaClassName, displayName: inst.displayName }));
    // Used by the display name generator, which walks a list of classes before reaching Deleted.
    utils.isSchemaClass.and.callFake((_inst: Instance, className: string) => className === 'Deleted');

    const createDeletedDialogService = jasmine.createSpyObj<CreateDeletedDialogService>(
      'CreateDeletedDialogService', ['openDialog']);
    createDeletedDialogService.openDialog.and.returnValue({ afterClosed: () => of(deletedObject) } as any);

    TestBed.configureTestingModule({
      providers: [
        DeletionService,
        { provide: DataService, useValue: dataService },
        { provide: InstanceUtilities, useValue: utils },
        { provide: Store, useValue: jasmine.createSpyObj<Store>('Store', ['dispatch']) },
        { provide: CreateDeletedDialogService, useValue: createDeletedDialogService },
        {
          provide: CommitDeletedDialogService,
          useValue: jasmine.createSpyObj<CommitDeletedDialogService>('CommitDeletedDialogService', ['openDialog'])
        },
        {
          provide: DeleteBulkDialogService,
          useValue: jasmine.createSpyObj<DeleteBulkDialogService>('DeleteBulkDialogService', ['openDialog'])
        },
        {
          provide: CommitResultDialogService,
          useValue: jasmine.createSpyObj<CommitResultDialogService>('CommitResultDialogService', ['openDialog'])
        },
        { provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open']) },
      ]
    });
    service = TestBed.inject(DeletionService);
  }

  it('commits it under a generated name, not the placeholder', () => {
    setUp([1227784]);

    service.createDeletedObject([{ dbId: 1227784, displayName: 'A pathway', schemaClassName: 'Pathway' }]);

    expect(deletedObject.displayName).toBe('Deletion of instance: 1227784');
    expect(dataService.deleteByDeleted).toHaveBeenCalledWith(deletedObject);
    expect(dataService.deleteByDeleted.calls.mostRecent().args[0].displayName)
      .withContext('the instance sent to the server carries the generated name')
      .toBe('Deletion of instance: 1227784');
  });

  it('names a deletion of several instances in the plural', () => {
    setUp([75761, 8852186]);

    service.createDeletedObject([
      { dbId: 75761, displayName: 'A pathway', schemaClassName: 'Pathway' },
      { dbId: 8852186, displayName: 'Another pathway', schemaClassName: 'Pathway' },
    ]);

    expect(deletedObject.displayName).toBe('Deletion of instances: 75761, 8852186');
  });

  it('does nothing when the curator cancels the dialog', () => {
    setUp([1227784]);
    (TestBed.inject(CreateDeletedDialogService).openDialog as jasmine.Spy)
      .and.returnValue({ afterClosed: () => of(undefined) } as any);

    service.createDeletedObject([{ dbId: 1227784, displayName: 'A pathway', schemaClassName: 'Pathway' }]);

    expect(dataService.deleteByDeleted).not.toHaveBeenCalled();
    expect(deletedObject.displayName).toBe(NEW_DISPLAY_NAME);
  });
});
