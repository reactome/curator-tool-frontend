import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompareUpdatedInstanceDialog } from './instance-comparison-dialog.component';

describe('NewInstanceDialogComponent', () => {
  let component: CompareUpdatedInstanceDialog;
  let fixture: ComponentFixture<CompareUpdatedInstanceDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CompareUpdatedInstanceDialog ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompareUpdatedInstanceDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
