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
  // Regex operand doesn't reflow the condition builder. The wording follows what the
  // server actually does: Cypher's =~ is an anchored, case-sensitive match, so a bare
  // word matches nothing and wrapping the pattern is the curator's job.
  regexTooltip: string = 'The pattern has to match the whole value and is case sensitive: '
    + 'use .* to match part of it (e.g. .*cyclin.*) and (?i) to ignore case.';

  completeQuery() {
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
   * The search term is treated as a regular expression by the server, which matches it
   * against the whole attribute value. Nothing is validated here: a pattern that
   * JavaScript cannot compile can still be perfectly good on the server (an inline
   * '(?i)' is the obvious example), so rejecting it in the browser would block searches
   * that work.
   */
  isRegexOperand(operand: string = this.attributeCondition?.operand): boolean {
    return !!operand && operand.toLocaleLowerCase() === 'regex';
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
    return !!this.attributeCondition.searchKey && this.attributeCondition.searchKey.trim().length > 0;
  }

}
