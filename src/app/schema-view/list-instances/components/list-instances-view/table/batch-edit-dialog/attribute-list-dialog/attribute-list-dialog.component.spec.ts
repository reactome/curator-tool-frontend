import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttributeListDialogComponent } from './attribute-list-dialog.component';

describe('AttributeListDialogComponent', () => {
  let component: AttributeListDialogComponent;
  let fixture: ComponentFixture<AttributeListDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttributeListDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AttributeListDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
