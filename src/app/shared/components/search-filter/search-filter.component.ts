import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { DataService } from "../../../core/services/data.service";
import { SchemaClass } from "../../../core/models/reactome-schema.model";
import { AttributeCondition } from 'src/app/core/models/reactome-instance.model';
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

  @Output() searchInstancesAction: EventEmitter<AttributeCondition[]> = new EventEmitter();

  // For doing search
  attributeConditions: AttributeCondition[] = [];

  @Input() attributes: string[] = [];
  
  // To control if this component should be shown
  hideShowButtonLabel: string = "...";
  hideSearchPanel: string = "hidden";

  constructor() {
  }

  ngOnInit(): void {
    // Create a new attribute search criterium when the component is initialized so that the user can see something.
    this.addAttribute();
  }

  searchInstances(): void {
    this.searchInstancesAction.emit(this.attributeConditions);
  }

  hideSearchPane(): void {
    if (this.hideSearchPanel === "") {
      this.hideShowButtonLabel = "...";
      this.hideSearchPanel = "hidden";
    } 
    else {
      this.hideShowButtonLabel = "Hide Panel";
      this.hideSearchPanel = "";
    }
  }

  addAttribute() {
    let blankAttributeCondition : AttributeCondition = {
      attributeName: "displayName",
      operand: "Contains",
      searchKey: "",
      index: this.attributeConditions.length
    };
    this.attributeConditions.push(blankAttributeCondition);
  }

  removeAttribute(attCondition: AttributeCondition) {
    this.attributeConditions.splice(this.attributeConditions.indexOf(attCondition), 1);
  }

}
