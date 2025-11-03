import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommitDeletedDialogComponent } from './deleted-object-creation-option-dialog.component';

describe('CommitDeletedDialogComponent', () => {
  let component: CommitDeletedDialogComponent;
  let fixture: ComponentFixture<CommitDeletedDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommitDeletedDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommitDeletedDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
