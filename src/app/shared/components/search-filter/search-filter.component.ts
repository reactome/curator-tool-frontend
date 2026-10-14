import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, QueryList, ViewChildren, inject } from '@angular/core';
import { DataService } from "../../../core/services/data.service";
import { SchemaClass } from "../../../core/models/reactome-schema.model";
import { SearchCriterium } from 'src/app/core/models/reactome-instance.model';
import { Router } from "@angular/router";

interface Species {
  value: string;
  viewValue: string;
}

/**
 * This is a component used to group a set of critieria for instance search. Components using this component
 * should handle the actual search.
 */
@Component({
  selector: 'search-filter',
  templateUrl: './search-filter.component.html',
  styleUrls: ['./search-filter.component.scss'],
})
export class SearchInstanceComponent implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);

  @Output() addSearchCriterium: EventEmitter<SearchCriterium> = new EventEmitter();
  @Output() removeSearchCriterium: EventEmitter<SearchCriterium> = new EventEmitter();
  @Output() removeSearchCriteriumAt: EventEmitter<number> = new EventEmitter();
  @Output() search: EventEmitter<void> = new EventEmitter();

  // The list of conditions accumulated so far, shown as removable chips.
  @Input() criteria: SearchCriterium[] = [];


  // For doing search
  blankAttributeCondition : SearchCriterium = {
    attributeName: "displayName",
    operand: "Contains",
    searchKey: "",
  };

  @Input() attributes: string[] = [];

  /**
   * Conditions too long for one line are shown collapsed to their first line, with a toggle to
   * see the rest (e.g. a dbId list opened from Ask the Graph). Keyed by the condition object
   * rather than its index, so removing a condition leaves the others as they were.
   */
  expanded = new Set<SearchCriterium>();
  overflowing = new Set<SearchCriterium>();
  @ViewChildren('conditionText') private conditionTexts?: QueryList<ElementRef<HTMLElement>>;
  // Whether a condition fits on one line depends on the card's width, so measure on resize too.
  private resizeObserver?: ResizeObserver;

  // To control if this component should be shown
  hideShowButtonLabel: string = "...";
  hideSearchPanel: string = "hidden";

  constructor() {
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined' || !this.conditionTexts) return;
    this.resizeObserver = new ResizeObserver(() => this.zone.run(() => this.measureOverflow()));
    const observe = () => this.conditionTexts!.forEach(ref => this.resizeObserver!.observe(ref.nativeElement));
    observe(); // observe() reports each element once straight away, which does the first measurement
    this.conditionTexts.changes.subscribe(observe);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  toggleExpanded(criterium: SearchCriterium) {
    if (this.expanded.has(criterium))
      this.expanded.delete(criterium);
    else
      this.expanded.add(criterium);
  }

  /** Note which collapsed conditions are cut off, i.e. need the expand toggle. */
  private measureOverflow() {
    this.conditionTexts?.forEach(ref => {
      const el = ref.nativeElement;
      const criterium = this.criteria[Number(el.dataset['index'])];
      // An expanded condition shows everything, so it can't be measured; it keeps its toggle.
      if (!criterium || this.expanded.has(criterium)) return;
      if (el.scrollHeight > el.clientHeight + 1)
        this.overflowing.add(criterium);
      else
        this.overflowing.delete(criterium);
    });
  }

  addAttribute(attributeCondition: SearchCriterium) {
    this.addSearchCriterium.emit(attributeCondition);
  }

  performSearch(attributeCondition: SearchCriterium) {
    // Don't overload it
    this.search.emit();
  }

  removeAttribute(attributeCondition: SearchCriterium) {
    this.removeSearchCriterium.emit(attributeCondition);
  }

  removeCriterion(index: number) {
    this.removeSearchCriteriumAt.emit(index);
  }

  isNullOperand(operand: string): boolean {
    return !!operand && operand.toLocaleLowerCase().includes('null');
  }

  /**
   * The search key split after each '|', so that a long alternation (e.g. a dbId list) wraps
   * between its alternatives rather than in the middle of one.
   */
  breakAfterPipes(searchKey: string): string[] {
    return (searchKey ?? '').split(/(?<=\|)/);
  }

}
