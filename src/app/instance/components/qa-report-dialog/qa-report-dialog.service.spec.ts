import { TestBed } from '@angular/core/testing';

import { QAReportDialogService } from './qa-report-dialog.service';

describe('QAReportDialogService', () => {
  let service: QAReportDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QAReportDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
