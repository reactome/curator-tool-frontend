import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeletedObjectCreationOptionDialogComponent } from './deleted-object-creation-option-dialog.component';

describe('DeletedObjectCreationOptionDialogComponent', () => {
  let component: DeletedObjectCreationOptionDialogComponent;
  let fixture: ComponentFixture<DeletedObjectCreationOptionDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletedObjectCreationOptionDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DeletedObjectCreationOptionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
