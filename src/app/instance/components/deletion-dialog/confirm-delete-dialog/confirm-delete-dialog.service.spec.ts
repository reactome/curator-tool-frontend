import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { createMatDialogSpy, expectDialogService, makeInstance } from 'src/testing';
import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog.component';
import { ConfirmDeleteDialogService } from './confirm-delete-dialog.service';

describe('ConfirmDeleteDialogService', () => {
  let service: ConfirmDeleteDialogService;
  let dialog: ReturnType<typeof createMatDialogSpy>;

  beforeEach(() => {
    dialog = createMatDialogSpy();
    TestBed.configureTestingModule({
      providers: [ConfirmDeleteDialogService, { provide: MatDialog, useValue: dialog }]
    });
    service = TestBed.inject(ConfirmDeleteDialogService);
  });

  it('opens the confirmation dialog with the instance awaiting confirmation', () => {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

    const ref = service.openDialog(instance);

    expectDialogService(dialog, ref, ConfirmDeleteDialogComponent, instance);
  });
});
