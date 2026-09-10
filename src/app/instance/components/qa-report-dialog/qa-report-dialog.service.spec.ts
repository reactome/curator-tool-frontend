import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { createMatDialogSpy, makeFailedQAResult, makeInstance, makeQAReport } from 'src/testing';
import { QAReportDialogComponent } from './qa-report-dialog.component';
import { QAReportDialogService } from './qa-report-dialog.service';

describe('QAReportDialogService', () => {
  let service: QAReportDialogService;
  let dialog: ReturnType<typeof createMatDialogSpy>;

  beforeEach(() => {
    dialog = createMatDialogSpy();
    TestBed.configureTestingModule({
      providers: [QAReportDialogService, { provide: MatDialog, useValue: dialog }]
    });
    service = TestBed.inject(QAReportDialogService);
  });

  it('opens the QA dialog with the instance and no report, so the dialog fetches its own', () => {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

    const ref = service.openDialog(instance);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    const [component, config] = dialog.open.calls.mostRecent().args;
    expect(component).toBe(QAReportDialogComponent);
    expect(config.data.instance).toBe(instance);
    expect(config.data.report).toBeUndefined();
    expect(ref).toBe(dialog.ref);
  });

  it('passes a pre-built report through so the dialog skips the server fetch', () => {
    // Client-side checks build their own report; re-fetching would discard it and show
    // the server's view instead.
    const instance = makeInstance({ dbId: 100 });
    const report = makeQAReport(instance, [
      makeFailedQAResult('Missing species', ['DB_ID'], [['102']])
    ]);

    service.openDialog(instance, report);

    expect(dialog.open.calls.mostRecent().args[1].data.report).toBe(report);
  });
});
