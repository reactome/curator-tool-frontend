import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QAReportTable } from './qa-report-table.component';

describe('SelectedInstancesTableComponent', () => {
  let component: QAReportTable;
  let fixture: ComponentFixture<QAReportTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QAReportTable ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QAReportTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
