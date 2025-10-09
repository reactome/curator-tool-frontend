import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteBulkDialogComponent } from './delete-bulk-dialog.component';

describe('DeleteBulkDialogComponent', () => {
  let component: DeleteBulkDialogComponent;
  let fixture: ComponentFixture<DeleteBulkDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DeleteBulkDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeleteBulkDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
