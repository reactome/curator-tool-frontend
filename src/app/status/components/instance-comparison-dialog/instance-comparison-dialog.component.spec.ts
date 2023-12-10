import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstanceComparisonDialog } from './instance-comparison-dialog.component';

describe('NewInstanceDialogComponent', () => {
  let component: InstanceComparisonDialog;
  let fixture: ComponentFixture<InstanceComparisonDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstanceComparisonDialog ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstanceComparisonDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
