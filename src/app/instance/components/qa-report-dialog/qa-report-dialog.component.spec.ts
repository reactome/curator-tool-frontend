import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { QAReport } from 'src/app/core/models/qa-report.model';
import { DataService } from 'src/app/core/services/data.service';
import {
  commonTestProviders,
  componentTestImports,
  makeFailedQAResult,
  makeInstance,
  makeQAReport,
  makeQAResult,
  provideDialogContext
} from 'src/testing';
import { QAReportDialogComponent } from './qa-report-dialog.component';

describe('QAReportDialogComponent', () => {
  let dataService: jasmine.SpyObj<DataService>;
  const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

  /** Builds the dialog for `data`, with `fetched` as what the server would return. */
  function build(
    data: { instance: any; report?: QAReport },
    fetched: QAReport = makeQAReport(instance)
  ): { component: QAReportDialogComponent; dialogRef: MatDialogRef<QAReportDialogComponent> } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        QAReportDialogComponent,
        ...provideDialogContext(data),
        { provide: MAT_DIALOG_DATA, useValue: data }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    dataService.fetchQAReport.and.returnValue(of(fetched));
    return {
      component: TestBed.inject(QAReportDialogComponent),
      dialogRef: TestBed.inject(MatDialogRef)
    };
  }

  it('fetches the server-side report when none was supplied', () => {
    build({ instance });

    expect(dataService.fetchQAReport).toHaveBeenCalledWith(instance);
  });

  it('uses a pre-built report and skips the server fetch', () => {
    // A client-side check (e.g. the diagram content validator) builds its own report;
    // re-fetching would throw it away and show the server's view instead.
    const report = makeQAReport(instance, [makeQAResult('Client-side check')]);

    const { component } = build({ instance, report });

    expect(dataService.fetchQAReport).not.toHaveBeenCalled();
    expect(component.qaReport).toBe(report);
  });

  it('reports a pass when every check passed', () => {
    const report = makeQAReport(instance, [
      makeQAResult('Compartment consistency'),
      makeQAResult('Species present')
    ]);

    const { component } = build({ instance, report });

    expect(component.qaReportPassed).toBeTrue();
  });

  it('reports a failure when any single check failed', () => {
    const report = makeQAReport(instance, [
      makeQAResult('Compartment consistency'),
      makeFailedQAResult('Missing species', ['DB_ID'], [['102']])
    ]);

    const { component } = build({ instance, report });

    expect(component.qaReportPassed).toBeFalse();
  });

  it('treats a report with no checks as a pass', () => {
    const { component } = build({ instance, report: makeQAReport(instance, []) });

    expect(component.qaReportPassed).toBeTrue();
  });

  it('applies the fetched report once it arrives', () => {
    const fetched = makeQAReport(instance, [
      makeFailedQAResult('Missing species', ['DB_ID'], [['102']])
    ]);

    const { component } = build({ instance }, fetched);

    expect(component.qaReport).toBe(fetched);
    expect(component.qaReportPassed).toBeFalse();
  });

  it('shows the instance immediately, before the report has arrived', () => {
    // qaReport is seeded with just the instance so the template has a title to render
    // rather than throwing on undefined.
    const { component } = build({ instance });

    expect(component.qaReport!.instance).toBe(instance);
  });

  it('closes with the pass/fail verdict so the caller can gate a commit', () => {
    const report = makeQAReport(instance, [
      makeFailedQAResult('Missing species', ['DB_ID'], [['102']])
    ]);

    const { component, dialogRef } = build({ instance, report });
    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('closes with true when the report passed', () => {
    const { component, dialogRef } = build({
      instance,
      report: makeQAReport(instance, [makeQAResult('All good')])
    });

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('closes with an autofix request when auto-fix is chosen', () => {
    const { component, dialogRef } = build({ instance });

    component.onAutoFix();

    expect(dialogRef.close).toHaveBeenCalledWith('autofix');
  });
});
