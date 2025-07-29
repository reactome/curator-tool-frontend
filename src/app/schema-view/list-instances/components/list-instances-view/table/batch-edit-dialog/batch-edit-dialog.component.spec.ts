import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BatchEditDialogComponent } from './batch-edit-dialog.component';

describe('BatchEditComponent', () => {
  let component: BatchEditDialogComponent;
  let fixture: ComponentFixture<BatchEditDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BatchEditDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BatchEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
