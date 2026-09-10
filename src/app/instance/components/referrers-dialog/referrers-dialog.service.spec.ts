import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { createMatDialogSpy, expectDialogService, makeInstance } from 'src/testing';
import { ReferrersDialogComponent } from './referrers-dialog.component';
import { ReferrersDialogService } from './referrers-dialog.service';

describe('ReferrersDialogService', () => {
  let service: ReferrersDialogService;
  let dialog: ReturnType<typeof createMatDialogSpy>;

  beforeEach(() => {
    dialog = createMatDialogSpy();
    TestBed.configureTestingModule({
      providers: [ReferrersDialogService, { provide: MatDialog, useValue: dialog }]
    });
    service = TestBed.inject(ReferrersDialogService);
  });

  it('opens the referrers dialog with the instance as its data', () => {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

    const ref = service.openDialog(instance);

    expectDialogService(dialog, ref, ReferrersDialogComponent, instance);
  });

  it('opens the dialog wide enough for the referrer table', () => {
    service.openDialog(makeInstance());

    expect(dialog.open.calls.mostRecent().args[1].width).toEqual('1000px');
  });
});
