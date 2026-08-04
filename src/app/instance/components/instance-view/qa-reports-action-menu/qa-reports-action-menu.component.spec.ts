import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QAReportsActionMenuComponent } from './qa-reports-action-menu.component';

describe('ToolTipComponent', () => {
  let component: QAReportsActionMenuComponent;
  let fixture: ComponentFixture<QAReportsActionMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QAReportsActionMenuComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QAReportsActionMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
