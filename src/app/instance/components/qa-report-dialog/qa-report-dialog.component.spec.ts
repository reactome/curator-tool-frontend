import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QAReportDialogComponent } from './qa-report-dialog.component';

describe('NewInstanceDialogComponent', () => {
  let component: QAReportDialogComponent;
  let fixture: ComponentFixture<QAReportDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QAReportDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QAReportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
