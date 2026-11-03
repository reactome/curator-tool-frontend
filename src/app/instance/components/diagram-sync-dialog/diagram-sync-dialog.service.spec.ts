import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { createMatDialogSpy, expectDialogService, makeInstance } from 'src/testing';
import { DiagramSyncDialogComponent } from './diagram-sync-dialog.component';
import { DiagramSyncDialogService } from './diagram-sync-dialog.service';

describe('DiagramSyncDialogService', () => {
  let service: DiagramSyncDialogService;
  let dialog: ReturnType<typeof createMatDialogSpy>;

  beforeEach(() => {
    dialog = createMatDialogSpy();
    TestBed.configureTestingModule({
      providers: [DiagramSyncDialogService, { provide: MatDialog, useValue: dialog }]
    });
    service = TestBed.inject(DiagramSyncDialogService);
  });

  it('opens the diagram sync dialog for the pathway, which runs the check itself', () => {
    const pathway = makeInstance({ dbId: 1430728, displayName: 'Metabolism', schemaClassName: 'Pathway' });

    const ref = service.openDialog(pathway);

    expectDialogService(dialog, ref, DiagramSyncDialogComponent, { pathway });
  });
});
