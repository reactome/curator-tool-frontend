import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

import { AttributeConditionComponent } from './attribute-condition.component';

describe('AttributeConditionComponent regex operand', () => {
  let component: AttributeConditionComponent;
  let fixture: ComponentFixture<AttributeConditionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AttributeConditionComponent],
      imports: [
        FormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        MatButtonModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AttributeConditionComponent);
    component = fixture.componentInstance;
    component.schemaClassAttributes = ['displayName'];
    component.attributeCondition = {
      attributeName: 'displayName',
      operand: 'Contains',
      searchKey: '',
    };
    fixture.detectChanges();
  });

  it('offers Regex in the operand list', () => {
    expect(component.operands).toContain('Regex');
  });

  it('explains the matching rules through a tooltip rather than an inline hint', () => {
    component.attributeCondition.operand = 'Regex';
    component.attributeCondition.searchKey = '^Cyclin.*';
    fixture.detectChanges();
    expect(component.regexError()).toBeNull();
    expect(component.canAddCondition()).toBeTrue();
    // The help icon carries the explanation; nothing is added below the field, so the
    // condition builder keeps its height when the operand changes.
    const icon = fixture.nativeElement.querySelector('.regex-help-icon');
    expect(icon).withContext('help icon should be shown for the Regex operand').toBeTruthy();
    expect(fixture.nativeElement.querySelector('mat-hint')).toBeNull();
  });

  it('hides the help icon for non-regex operands', () => {
    component.attributeCondition.operand = 'Contains';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.regex-help-icon')).toBeNull();
  });

  it('swaps the hint for an error on a malformed pattern without error', () => {
    component.attributeCondition.operand = 'Regex';
    component.attributeCondition.searchKey = '^Cyclin.*';
    fixture.detectChanges();
    // The transition from the hint to the error message is where a form field would
    // complain about duplicated hints if both could be shown at once.
    component.attributeCondition.searchKey = '[unclosed';
    fixture.detectChanges();
    expect(component.regexError()).toContain('Invalid regular expression');
    expect(component.canAddCondition()).toBeFalse();
  });

  it('does not treat a plain term as a regex', () => {
    component.attributeCondition.operand = 'Contains';
    component.attributeCondition.searchKey = '[unclosed';
    fixture.detectChanges();
    expect(component.regexError()).toBeNull();
    expect(component.canAddCondition()).toBeTrue();
  });
});
