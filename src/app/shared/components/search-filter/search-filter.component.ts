import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
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
export class SearchInstanceComponent implements OnInit {

  @Output() addSearchCriterium: EventEmitter<SearchCriterium> = new EventEmitter();
  @Output() removeSearchCriterium: EventEmitter<SearchCriterium> = new EventEmitter();
  @Output() search: EventEmitter<void> = new EventEmitter();


  // For doing search
  blankAttributeCondition : SearchCriterium = {
    attributeName: "displayName",
    operand: "Contains",
    searchKey: "",
  };

  @Input() attributes: string[] = [];

  // To control if this component should be shown
  hideShowButtonLabel: string = "...";
  hideSearchPanel: string = "hidden";

  constructor() {
  }

  ngOnInit(): void {
    // Create a new attribute search criterium when the component is initialized so that the user can see something.
    //setTimeout(() => this.addAttribute()); // Add a delay to avoid NG0100 error.
  }

  addAttribute(attributeCondition: SearchCriterium) {
    this.addSearchCriterium.emit(attributeCondition);
  }

  performSearch(attributeCondition: SearchCriterium) {
    // Fire the add search criterium event first and then ask to do search
    // to avoid overloading
    this.addSearchCriterium.emit(attributeCondition);
    this.search.emit();
  }

  removeAttribute(attributeCondition: SearchCriterium) {
    this.removeSearchCriterium.emit(attributeCondition);
  }

}
