import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeletedObjectCreationDialogComponent } from './deleted-object-creation-dialog.component';

describe('DeletedObjectCreationDialogComponent', () => {
  let component: DeletedObjectCreationDialogComponent;
  let fixture: ComponentFixture<DeletedObjectCreationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletedObjectCreationDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletedObjectCreationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
