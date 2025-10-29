import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateDeletedDialogComponent } from './create-deleted-dialog.component';

describe('CreateDeletedDialogComponent', () => {
  let component: CreateDeletedDialogComponent;
  let fixture: ComponentFixture<CreateDeletedDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateDeletedDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CreateDeletedDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
