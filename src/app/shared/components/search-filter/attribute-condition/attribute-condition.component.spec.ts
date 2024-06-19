import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttributeConditionComponent } from './attribute-condition.component';

describe('AttributeConditionComponent', () => {
  let component: AttributeConditionComponent;
  let fixture: ComponentFixture<AttributeConditionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttributeConditionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttributeConditionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
