import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { createMatDialogSpy, expectDialogService, makeInstance } from 'src/testing';
import { DeletionDialogComponent } from './deletion-dialog.component';
import { DeletionDialogService } from './deletion-dialog.service';

describe('DeletionDialogService', () => {
  let service: DeletionDialogService;
  let dialog: ReturnType<typeof createMatDialogSpy>;

  beforeEach(() => {
    dialog = createMatDialogSpy();
    TestBed.configureTestingModule({
      providers: [DeletionDialogService, { provide: MatDialog, useValue: dialog }]
    });
    service = TestBed.inject(DeletionDialogService);
  });

  it('opens the deletion dialog with the instance to delete as its data', () => {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

    const ref = service.openDialog(instance);

    expectDialogService(dialog, ref, DeletionDialogComponent, instance);
  });

  it('returns the ref so the caller can react to the deletion being confirmed', () => {
    const dialogWithResult = createMatDialogSpy(makeInstance({ dbId: 100 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [DeletionDialogService, { provide: MatDialog, useValue: dialogWithResult }]
    });

    const ref = TestBed.inject(DeletionDialogService).openDialog(makeInstance());
    let closedWith: any;
    ref.afterClosed().subscribe(r => (closedWith = r));

    expect(closedWith.dbId).toEqual(100);
  });
});
