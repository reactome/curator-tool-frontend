import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { PageEvent } from "@angular/material/paginator";
import { SearchCriterium, Instance, InstanceList } from "../../../../../core/models/reactome-instance.model";
import { DataService } from "../../../../../core/services/data.service";
import { ViewOnlyService } from "../../../../../core/services/view-only.service";
import { Router } from "@angular/router";
import { ReferrersDialogService } from "../../../../../instance/components/referrers-dialog/referrers-dialog.service";
import { DeletionDialogService } from "../../../../../instance/components/deletion-dialog/deletion-dialog.service";

@Component({
  selector: 'app-instance-selection',
  templateUrl: './instance-selection.component.html',
  styleUrls: ['./instance-selection.component.scss'],
})
export class InstanceSelectionComponent {

  skip: number = 0;
  // This is for doing simple text or dbId based search
  searchKey: string | undefined = '';
  // For doing attribute-based search (i.e. advanced search)
  // Empty array as a flag for not doing it.
  searchCriteria: SearchCriterium[] = [];
  // Used to display the text to the user for advanced search
  advancedSearchKey: string = '';
  pageSizeOptions = [20, 50, 100];
  pageIndex: number = 0;
  className: string = "";
  // Total count returned from the server
  instanceCount: number = 0;
  selected: number = 0; //move
  showProgressSpinner: boolean = true;
  // To be displayed in instance list table
  data: Instance[] = [];
  actionButtons: string[] = ["launch", "delete", "list_alt"];
  // Used to popup attributes for advanced search (i.e. SearchFilterComponent)
  schemaClassAttributes: string[] = [];
  // New instances to be listed at the top of the first page
  newInstances: Instance[] = [];
  // Flag to indicate if the advanced search component should be displayed
  showFilterComponent: boolean = false;

  // A flag to use route to load
  @Input() useRoute: boolean = false;
  @Input() pageSize: number = 50;
  // A flag to indicate this selection is used for editing
  @Input() isSelection: boolean = false;

  @Output() clickEvent = new EventEmitter<Instance>();

  @Input() set setClassName(inputClassName: string) {
    setTimeout(() => {
      this.className = inputClassName;
      this.skip = 0;
      this.showProgressSpinner = true;
      this.loadInstances();
      this.loadSchemaClasses();
    }); // Delay to avoid the 'NG0100: ExpressionChangedAfterItHasBeenChecked' error
  }

  constructor(private dataService: DataService,
    private router: Router,
    private referrersDialogService: ReferrersDialogService,
    private deletionDialogService: DeletionDialogService) {
  }

  /**
   * Load the instances directly by calling the data service. Before call this method,
   * make sure className has been specified.
   */
  loadInstances() {
    // Make sure className is set!
    if (this.className && this.className.length > 0) {
      this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey)
        .subscribe((instancesList) => {
          this.displayInstances(instancesList);
          this.showProgressSpinner = false;
        }
        )
    }
  }

  private displayInstances(instancesList: InstanceList) {
    this.instanceCount = instancesList.totalCount;
    this.data = instancesList.instances;
    // The first page should be 0
    this.pageIndex = Math.floor(this.skip / this.pageSize);
  }

  /**
   * Load the schema class for this instance list so that we can do attribute-based
   * search.
   */
  loadSchemaClasses() {
    if (this.className && this.className.length > 0) {
      this.dataService.fetchSchemaClass(this.className).subscribe(cls => {
        if (cls && cls.attributes) {
          // Make a copy and then sort
          let attributes = [...cls.attributes];
          attributes.sort((a, b) => a.name.localeCompare(b.name));
          this.schemaClassAttributes.length = 0; // Empty it first
          attributes.forEach(attr => {
            this.schemaClassAttributes.push(attr.name);
          });
        }
      });
    }
  }

  doBasicSearch(skip: number = 0) {
    // Start with the first instance
    this.skip = skip;
    if (this.useRoute) {
      let url = this.getListInstancesURL();
      if (this.searchKey && this.searchKey.trim().length > 0)
        this.router.navigate([url], { queryParams: { query: this.searchKey.trim() } });
      else
        this.router.navigate([url]);
    } else
      this.loadInstances();
  }

  onPageChange(pageObject: PageEvent) {
    const skip = pageObject.pageIndex * pageObject.pageSize;
    // Page size may be changed. However, page index will be calculated
    // later on. 
    this.pageSize = pageObject.pageSize;
    if (this.searchCriteria.length === 0)
      this.doBasicSearch(skip);
    else 
      this.doAdvancedSearch();
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId
    this.clickEvent.emit(row)
  }

  handleAction(actionEvent: { instance: Instance, action: string }) {
    switch (actionEvent.action) {
      case "launch": {
        const dbId = actionEvent.instance.dbId;
        // As of October 15, don't use view only
        window.open(`schema_view/instance/${dbId}`, '_blank');
        // window.open(`schema_view/instance/${dbId}?${ViewOnlyService.KEY}=true`, '_blank');
        break;
      }
      case "delete": {
        this.deletionDialogService.openDialog(actionEvent.instance);
        break;
      }
      case "list_alt": {
        this.referrersDialogService.openDialog(actionEvent.instance);
        break;

      }
    }
  }

  /**
   * Handle the search button action.
   * @param searchFilters
   */
  addSearchCriterium(attributeCondition: SearchCriterium) {
    if (!this.validateSearchCriterium(attributeCondition))
      return; // Make sure only valid criterium can be added
    this.searchCriteria.push(attributeCondition);
    this.updateAdvancedSearchKey();
  }

  private updateAdvancedSearchKey() {
    // Reset from the scratch
    let text = '';
    for (let criterium of this.searchCriteria) {
      if (text.length > 0)
        text += ' '; // give it an extra space
      text += "(" + criterium.attributeName + "[" + criterium.operand;
      if (criterium.searchKey && criterium.searchKey.length > 0)
        text += ": " + criterium.searchKey;
      text += "])";
    }
    this.advancedSearchKey = text;
  }

  /**
   * Check if the provided search condition is valid.
   * @param criterium
   */
  private validateSearchCriterium(criterium: SearchCriterium) {
    // Since search criterium doesn't have undefined, must check for length
    if (!criterium.attributeName || criterium.attributeName.trim().length === 0)
      return false;
    // For operands that are not related to null, the search key must be provided
    if (!criterium.operand.toLocaleLowerCase().includes('null')) {
      const key = criterium.searchKey;
      if (!key || key.trim().length === 0)
        return false;
    }
    else {
      // Make sure key is empty
      criterium.searchKey = '';
    }
    return true;
  }

  toggleSearchPane() {
    this.showFilterComponent = !this.showFilterComponent;
  }

  removeSearchCriterium() {
    if (this.searchCriteria.length > 0) {
      this.searchCriteria.pop();
      this.updateAdvancedSearchKey();
    }
  }

  /**
   * Perform advance search.
   */
  doAdvancedSearch() {
    if (this.searchCriteria.length === 0)
      return; // Just in case
    // Need attributes, operands and keys separate

    let attributes: string[] = [];
    let operands: string[] = [];
    let searchKeys: string[] = [];
    this.searchCriteria.forEach(criterium => {
      attributes.push(criterium.attributeName);
      operands.push(criterium.operand);
      searchKeys.push(criterium.searchKey.trim());
    });

    if (this.useRoute) {
      let url = this.getListInstancesURL();
      this.router.navigate([url],
        {
          queryParams: {
            attributes: attributes.toString(),
            operands: operands.toString(),
            searchKeys: searchKeys.toString()
          },
        });
    }
    else
      this.searchInstances(attributes, operands, searchKeys);
  }

  private getListInstancesURL() {
    let url = '/schema_view/list_instances/' + this.className + '/' + this.skip + '/' + this.pageSize;
    return url;
  }

  /**
   * Search instances based on a set of search criteria.
   * @param attributeNames
   * @param operands
   * @param searchKeys
   */
  searchInstances(attributeNames: string[],
    operands: string[],
    searchKeys: string[]
  ) {
    this.showProgressSpinner = true;
    let parseSearchKeys: string[] = [];
    for (let searchKey of searchKeys) {
      parseSearchKeys.push(searchKey);
    }
    this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributeNames, operands, parseSearchKeys)
      .subscribe(instanceList => {
        this.displayInstances(instanceList);
        this.showProgressSpinner = false;
      })
  }

  navigateUrl(instance: Instance){
    if(!this.isSelection)
       this.router.navigate(["/schema_view/instance/" + instance.dbId.toString()])
  }
}
