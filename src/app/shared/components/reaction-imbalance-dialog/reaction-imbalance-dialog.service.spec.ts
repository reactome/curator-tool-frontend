import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { createMatDialogSpy, expectDialogService } from 'src/testing';
import { ReactionImbalanceDialogComponent } from './reaction-imbalance-dialog.component';
import { ReactionImbalanceDialogService } from './reaction-imbalance-dialog.service';

describe('ReactionImbalanceDialogService', () => {
  let service: ReactionImbalanceDialogService;
  let dialog: ReturnType<typeof createMatDialogSpy>;

  beforeEach(() => {
    dialog = createMatDialogSpy();
    TestBed.configureTestingModule({
      providers: [ReactionImbalanceDialogService, { provide: MatDialog, useValue: dialog }]
    });
    service = TestBed.inject(ReactionImbalanceDialogService);
  });

  it('opens the report dialog with the event to check', () => {
    const ref = service.openDialog(162582, 'Signal Transduction');
    expectDialogService(dialog, ref, ReactionImbalanceDialogComponent,
      { dbId: 162582, displayName: 'Signal Transduction' });
  });

  it('offers the check for pathways and reactions that are in the database', () => {
    expect(service.canCheck('Pathway', 162582)).toBeTrue();
    expect(service.canCheck('TopLevelPathway', 162582)).toBeTrue();
    expect(service.canCheck('Reaction', 5358340)).toBeTrue();
  });

  it('does not offer the check for other events or for new instances', () => {
    // The backend skips these reaction types, so the check would always report 0 reactions.
    expect(service.canCheck('BlackBoxEvent', 1)).toBeFalse();
    expect(service.canCheck('Polymerisation', 1)).toBeFalse();
    expect(service.canCheck('Pathway', -1)).toBeFalse();
    expect(service.canCheck(undefined, 1)).toBeFalse();
  });
});
