import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { PageEvent } from "@angular/material/paginator";
import { SearchCriterium, Instance } from "../../../../../core/models/reactome-instance.model";
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
  advancedSearchKey: string | undefined = '';
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

  // Outputting the search string to update the header
  @Output() queryEvent = new EventEmitter<string>();
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
          this.instanceCount = instancesList.totalCount;
          this.data = instancesList.instances;
          // The first page should be 0
          this.pageIndex = Math.floor(this.skip / this.pageSize);
          this.showProgressSpinner = false;
        }
        )
    }
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

  searchForName(skip: number = 0) {
    // Start with the first instance
    this.skip = skip;
    if (this.useRoute) {
      let url = '/schema_view/list_instances/' + this.className + '/' + this.skip + '/' + this.pageSize;
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
      this.searchForName(skip)
    else {
      // For advanced search
    }
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId
    this.clickEvent.emit(row)
  }

  handleAction(actionEvent: { instance: Instance, action: string }) {
    switch (actionEvent.action) {
      case "launch": {
        const dbId = actionEvent.instance.dbId;
        window.open(`schema_view/instance/${dbId}?${ViewOnlyService.KEY}=true`, '_blank');
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
    let parseSearchKeys: string [] = [];
    for (let searchKey of searchKeys) {
      parseSearchKeys.push(searchKey);
    }
    this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributeNames, operands, parseSearchKeys)
      .subscribe(instanceList => {
        this.instanceCount = instanceList.totalCount;
        this.data = instanceList.instances;
        this.showProgressSpinner = false;
      })
    this.queryEvent.emit(this.searchKey);
  }

  /**
   * Handle the search button action.
   * @param searchFilters
   */
  searchAction(attributeCondition: SearchCriterium) {
    if (this.advancedSearchKey !== '') {
      this.advancedSearchKey += ","
    }
    this.advancedSearchKey += "("
      + attributeCondition.attributeName
      + "[" + attributeCondition.operand
      + ": " + attributeCondition.searchKey + "])";

  }

  /**
   * Check if the provided search condition is valid.
   * @param attribuateCondition
   */
  private isValidSearchCondition(attribuateCondition: SearchCriterium) {
    if (attribuateCondition.attributeName === undefined || attribuateCondition.attributeName === null)
      return false;
    // For operands that are not related to null, the search key must be provided
    if (!attribuateCondition.operand.toLocaleLowerCase().includes('null')) {
      const key = attribuateCondition.searchKey;
      if (key === undefined || key === null || key.trim().length === 0)
        return false;
    }
    return true;
  }

  showFilter() {
    this.showFilterComponent = !this.showFilterComponent;
  }

  parseAdvancedSearch(searchKey: string) {
    let attributeConditions: SearchCriterium[] = [];
    if (searchKey !== '') {
      let fullQuery = searchKey.split(',')
      for (let query of fullQuery) {
        let attributeName = query.split("(")[1].split("[")[0];
        let operand = query.split("[")[1].split(":")[0];
        let searchKey = query.split(": ")[1].split("]")[0];
        let attribuateCondition: SearchCriterium = new class implements SearchCriterium {
          attributeName: string = attributeName;
          operand: string = operand;
          searchKey: string = searchKey;
        }
        attributeConditions.push(attribuateCondition);
      }
    }
    return attributeConditions;
  }

  advancedSearch(searchKey: string) {
    if (searchKey !== '' || searchKey !== null) {
      let attributes = [];
      let operands = [];
      let searchKeys = [];
      let url = '/schema_view/list_instances/' + this.className;
      let attributeConditions: SearchCriterium[] = this.parseAdvancedSearch(searchKey);

      for (let attributeCondition of attributeConditions) {
        attributes.push(attributeCondition.attributeName);
        operands.push(attributeCondition.operand);
        searchKeys.push(attributeCondition.searchKey);
      }
      if (this.useRoute) {
        if (searchKey && searchKey.trim().length > 0) // Here we have to use merge to keep all parameters there. This looks like a bug in Angular!!!
        {
          this.router.navigate([url],
            {
              queryParams: {
                attributes: attributes.toString(),
                operands: operands.toString(),
                searchKeys: searchKeys.toString()
              },
              // Merge will keep the simple search query in the header
              //queryParamsHandling: 'merge' 
            });
          }
        else
          this.router.navigate([url]);
      } else
        this.loadInstances();
      this.searchInstances(attributes, operands, searchKeys);
    }
  }

  removeParameter() {
    let attributeConditions: SearchCriterium[] = this.parseAdvancedSearch(this.advancedSearchKey!)
    // Removing the last query 
    attributeConditions.pop();
    this.advancedSearchKey = '';
    for (let attributeCondition of attributeConditions) {
      this.searchAction(attributeCondition);
    }
  }

  /**
 * Handle the search button action.
 * @param searchFilters
 */
  completeSearch() {
    // // Don't search if there is no query
    // if(attributeCondition.searchKey !== ''){
    //   this.searchAction(attributeCondition);
    // }
    this.advancedSearch(this.advancedSearchKey!)
  }

  navigateUrl(instance: Instance){
    if(!this.isSelection)
       this.router.navigate(["/schema_view/instance/" + instance.dbId.toString()])
  }
}
