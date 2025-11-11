import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttributeEditComponent } from './attribute-edit.component';

describe('RowElementComponent', () => {
  let component: AttributeEditComponent;
  let fixture: ComponentFixture<AttributeEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AttributeEditComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttributeEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
