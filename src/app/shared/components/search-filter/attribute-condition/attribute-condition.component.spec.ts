import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SearchCriterium } from 'src/app/core/models/reactome-instance.model';
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

  it('takes the attribute list through the setter input', () => {
    component.schemaClassAttributes = ['displayName', 'name', 'definition'];

    expect(component.schemaAttributes).toEqual(['displayName', 'name', 'definition']);
  });

  it('offers the operands the backend supports', () => {
    expect(component.operands).toEqual([
      'Equal', 'Not Equal', 'Contains', 'Regex', 'IS NULL', 'IS NOT NULL'
    ]);
  });

  describe('null operands', () => {
    it('recognises IS NULL and IS NOT NULL', () => {
      expect(component.isNullOperand('IS NULL')).toBeTrue();
      expect(component.isNullOperand('IS NOT NULL')).toBeTrue();
    });

    it('does not treat a value operand as a null check', () => {
      expect(component.isNullOperand('Contains')).toBeFalse();
      expect(component.isNullOperand('Equal')).toBeFalse();
      expect(component.isNullOperand('Regex')).toBeFalse();
    });

    it('falls back to the operand of the bound condition', () => {
      component.attributeCondition.operand = 'IS NULL';

      expect(component.isNullOperand()).toBeTrue();
    });

    it('treats an empty operand as not a null check', () => {
      expect(component.isNullOperand('')).toBeFalse();
    });

    it('sends "null" as the search term for a null check', () => {
      // The term field is hidden for these operands, so the component has to supply the
      // value the backend expects rather than an empty string.
      component.attributeCondition = {
        attributeName: 'species', operand: 'IS NULL', searchKey: ''
      };
      const emitted: SearchCriterium[] = [];
      component.addAttributeCondition.subscribe(c => emitted.push(c));

      component.addNewCriterium();

      expect(emitted[0].searchKey).toEqual('null');
    });
  });

  describe('regex operand', () => {
    it('recognises the Regex operand case-insensitively', () => {
      expect(component.isRegexOperand('Regex')).toBeTrue();
      expect(component.isRegexOperand('regex')).toBeTrue();
    });

    it('does not treat Contains as a regex', () => {
      expect(component.isRegexOperand('Contains')).toBeFalse();
    });

    it('explains in its tooltip that the pattern must match the whole value', () => {
      // The server uses Cypher's =~, which is an anchored, case-sensitive match: a bare word
      // matches nothing. The tooltip is the only place the curator learns that, so its
      // wording is worth pinning.
      expect(component.regexTooltip).toContain('whole value');
      expect(component.regexTooltip).toContain('case sensitive');
      expect(component.regexTooltip).toContain('.*');
      expect(component.regexTooltip).toContain('(?i)');
    });

    it('accepts a pattern JavaScript cannot compile', () => {
      // '(?i)' is valid on the server but not in JS. Validating in the browser would block
      // searches that actually work, so nothing here may reject it.
      component.attributeCondition = {
        attributeName: 'displayName', operand: 'Regex', searchKey: '(?i).*cyclin.*'
      };
      const emitted: SearchCriterium[] = [];
      component.addAttributeCondition.subscribe(c => emitted.push(c));

      component.addNewCriterium();

      expect(emitted[0].searchKey).toEqual('(?i).*cyclin.*');
    });
  });

  describe('adding a condition', () => {
    beforeEach(() => {
      component.attributeCondition = {
        attributeName: 'displayName', operand: 'Contains', searchKey: 'cyclin'
      };
    });

    it('emits a copy, not the live condition object', () => {
      // The component keeps editing `attributeCondition` in place, so emitting it directly
      // would let the next keystroke mutate a condition already added to the list.
      const emitted: SearchCriterium[] = [];
      component.addAttributeCondition.subscribe(c => emitted.push(c));

      component.addNewCriterium();

      expect(emitted[0]).not.toBe(component.attributeCondition);
      expect(emitted[0].searchKey).toEqual('cyclin');
    });

    it('clears the search term afterwards, ready for the next condition', () => {
      component.addNewCriterium();

      expect(component.attributeCondition.searchKey).toEqual('');
    });

    it('keeps the attribute and operand so a series of terms can be entered', () => {
      component.addNewCriterium();

      expect(component.attributeCondition.attributeName).toEqual('displayName');
      expect(component.attributeCondition.operand).toEqual('Contains');
    });

    it('also fires the submit action when the query is completed', () => {
      const added: SearchCriterium[] = [];
      const submitted: SearchCriterium[] = [];
      component.addAttributeCondition.subscribe(c => added.push(c));
      component.submitAction.subscribe(c => submitted.push(c));

      component.completeQuery();

      expect(added.length).toEqual(1);
      expect(submitted.length).toEqual(1);
      expect(submitted[0]).toEqual(added[0]);
    });
  });

  describe('canAddCondition', () => {
    it('refuses when no attribute has been chosen', () => {
      component.attributeCondition = { attributeName: '', operand: 'Contains', searchKey: 'x' };

      expect(component.canAddCondition()).toBeFalse();
    });

    it('refuses a value operand with no search term', () => {
      component.attributeCondition = {
        attributeName: 'displayName', operand: 'Contains', searchKey: ''
      };

      expect(component.canAddCondition()).toBeFalse();
    });

    it('refuses a search term of only whitespace', () => {
      component.attributeCondition = {
        attributeName: 'displayName', operand: 'Contains', searchKey: '   '
      };

      expect(component.canAddCondition()).toBeFalse();
    });

    it('allows a value operand with a search term', () => {
      component.attributeCondition = {
        attributeName: 'displayName', operand: 'Contains', searchKey: 'cyclin'
      };

      expect(component.canAddCondition()).toBeTrue();
    });

    it('allows a null check with no search term', () => {
      component.attributeCondition = {
        attributeName: 'species', operand: 'IS NULL', searchKey: ''
      };

      expect(component.canAddCondition()).toBeTrue();
    });
  });

  describe('keyboard shortcuts', () => {
    beforeEach(() => {
      component.attributeCondition = {
        attributeName: 'displayName', operand: 'Contains', searchKey: 'cyclin'
      };
    });

    it('adds another condition without searching on a plain Enter', () => {
      // Enter stacks up conditions; Ctrl+Enter is what actually runs the search. Getting
      // these two the wrong way round would search on every term the curator types.
      const added: SearchCriterium[] = [];
      const submitted: SearchCriterium[] = [];
      component.addAttributeCondition.subscribe(c => added.push(c));
      component.submitAction.subscribe(c => submitted.push(c));

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(added.length).toEqual(1);
      expect(submitted.length).toEqual(0);
    });

    it('adds the condition and runs the search on Ctrl+Enter', () => {
      const added: SearchCriterium[] = [];
      const submitted: SearchCriterium[] = [];
      component.addAttributeCondition.subscribe(c => added.push(c));
      component.submitAction.subscribe(c => submitted.push(c));

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));

      expect(added.length).toEqual(1);
      expect(submitted.length).toEqual(1);
    });

    it('ignores other keys', () => {
      const added: SearchCriterium[] = [];
      component.addAttributeCondition.subscribe(c => added.push(c));

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'a' }));

      expect(added.length).toEqual(0);
    });
  });
});
