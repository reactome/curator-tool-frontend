import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { createMatDialogSpy, expectDialogService, makeInstance } from 'src/testing';
import { DeleteBulkDialogComponent } from './delete-bulk-dialog.component';
import { DeleteBulkDialogService } from './delete-bulk-dialog.service';

describe('DeleteBulkDialogService', () => {
  let service: DeleteBulkDialogService;
  let dialog: ReturnType<typeof createMatDialogSpy>;

  beforeEach(() => {
    dialog = createMatDialogSpy();
    TestBed.configureTestingModule({
      providers: [DeleteBulkDialogService, { provide: MatDialog, useValue: dialog }]
    });
    service = TestBed.inject(DeleteBulkDialogService);
  });

  it('opens the bulk-delete dialog with the whole selection as its data', () => {
    const instances = [makeInstance({ dbId: 100 }), makeInstance({ dbId: 101 })];

    const ref = service.openDialog(instances);

    expectDialogService(dialog, ref, DeleteBulkDialogComponent, instances);
  });

  it('passes an empty selection through rather than refusing to open', () => {
    // The dialog is what tells the curator nothing was selected, so the service must not
    // quietly swallow the call.
    service.openDialog([]);

    expect(dialog.open).toHaveBeenCalled();
    expect(dialog.open.calls.mostRecent().args[1].data).toEqual([]);
  });
});
