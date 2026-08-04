import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SearchCriterium } from 'src/app/core/models/reactome-instance.model';


@Component({
  selector: 'app-attribute-condition',
  templateUrl: './attribute-condition.component.html',
  styleUrl: './attribute-condition.component.scss'
})
export class AttributeConditionComponent {
  @Input() set schemaClassAttributes(schemaClassAttributes: string[]) {
    this.schemaAttributes = schemaClassAttributes;
  }

  @Input() attributeCondition! : SearchCriterium;

  @Output() addAttributeCondition: EventEmitter<SearchCriterium> = new EventEmitter();
  @Output() removeAttributeCondition: EventEmitter<SearchCriterium> = new EventEmitter();
  @Output() submitAction: EventEmitter<SearchCriterium> = new EventEmitter();

  schemaAttributes: string[] = [];

  operands: string[] = [
    'Equal',
    'Not Equal',
    'Contains',
    'Regex',
    'IS NULL',
    'IS NOT NULL'
  ];

  // Shown on hover rather than as a hint under the field, so that switching to the
  // Regex operand doesn't reflow the condition builder.
  regexTooltip: string = 'Matching is case-insensitive and covers the whole value: '
    + 'use .* to match part of it, e.g. .*cyclin.*';

  completeQuery() {
    if (this.regexError())
      return; // Don't send a pattern the backend will reject
    let copyAttributeCondition = this.cloneCriterium();
    this.addAttributeCondition.emit(copyAttributeCondition);
    this.submitAction.emit(copyAttributeCondition);
    this.resetSearchKey();
  }

  /**
   * Operands that check for the presence/absence of a value don't need a
   * search term, so the term field is hidden for them.
   */
  isNullOperand(operand: string = this.attributeCondition?.operand): boolean {
    return !!operand && operand.toLocaleLowerCase().includes('null');
  }

  /**
   * The search term is treated as a regular expression, matched against the whole
   * attribute value (the backend uses Cypher's =~, which is a full match).
   */
  isRegexOperand(operand: string = this.attributeCondition?.operand): boolean {
    return !!operand && operand.toLocaleLowerCase() === 'regex';
  }

  /**
   * Report a malformed regular expression while the curator is typing it, rather than
   * letting the backend reject the search after the fact.
   * @return null when the term is a usable pattern.
   */
  regexError(): string | null {
    if (!this.isRegexOperand())
      return null;
    const key = this.attributeCondition?.searchKey;
    if (!key || key.trim().length === 0)
      return null; // Nothing typed yet: canAddCondition already blocks an empty term.
    try {
      new RegExp(key);
      return null;
    }
    catch (e) {
      return 'Invalid regular expression: ' + (e instanceof Error ? e.message : e);
    }
  }

  private resetSearchKey() {
    this.attributeCondition.searchKey = '';
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (event.ctrlKey) {
        // Handle Ctrl + Enter
        this.completeQuery();
      }
      else 
        this.addNewCriterium();
      event.preventDefault(); // Optionally prevent default behavior like form submission
    }
  }

  private cloneCriterium(): SearchCriterium {
    return {
      attributeName: this.attributeCondition.attributeName,
      operand: this.attributeCondition.operand,
      searchKey: this.attributeCondition.operand.includes('NULL') ? 'null' : this.attributeCondition.searchKey
    }
  }

  addNewCriterium(){
    let copyAttributeCondition = this.cloneCriterium();
    this.addAttributeCondition.emit(copyAttributeCondition);
    this.resetSearchKey();
  }

  /**
   * A condition can be added when a search term is present, or when the
   * operand is a NULL check (which needs no term).
   */
  canAddCondition(): boolean {
    if (!this.attributeCondition?.attributeName)
      return false;
    if (this.isNullOperand())
      return true;
    if (this.regexError())
      return false;
    return !!this.attributeCondition.searchKey && this.attributeCondition.searchKey.trim().length > 0;
  }

}
