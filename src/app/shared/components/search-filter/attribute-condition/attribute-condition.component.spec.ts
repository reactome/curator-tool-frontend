import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AttributeConditionComponent } from './attribute-condition.component';

describe('AttributeConditionComponent', () => {
  let component: AttributeConditionComponent;
  let fixture: ComponentFixture<AttributeConditionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AttributeConditionComponent],
      imports: [
        FormsModule,
        NoopAnimationsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttributeConditionComponent);
    component = fixture.componentInstance;
    component.attributeCondition = {
      attributeName: 'displayName',
      operand: 'Contains',
      searchKey: '',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
