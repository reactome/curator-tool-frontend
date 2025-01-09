import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { PageEvent } from "@angular/material/paginator";
import { SearchCriterium, Instance, InstanceList } from "../../../../../core/models/reactome-instance.model";
import { DataService } from "../../../../../core/services/data.service";
import { Router } from "@angular/router";
import { ReferrersDialogService } from "../../../../../instance/components/referrers-dialog/referrers-dialog.service";
import { DeletionDialogService } from "../../../../../instance/components/deletion-dialog/deletion-dialog.service";
import { Store } from '@ngrx/store';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ActionButton } from './instance-list-table/instance-list-table.component';
import { ListInstancesDialogService } from '../../list-instances-dialog/list-instances-dialog.service';
import { deleteInstances, newInstances } from 'src/app/instance/state/instance.selectors';
import { combineLatest, Subscription } from 'rxjs';

@Component({
  selector: 'app-instance-selection',
  templateUrl: './instance-selection.component.html',
  styleUrls: ['./instance-selection.component.scss'],
})
export class InstanceSelectionComponent implements OnInit, OnDestroy {

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
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.LAUNCH, ACTION_BUTTONS.LIST, ACTION_BUTTONS.DELETE];
  secondaryActionButtons: Array<ActionButton> =[ACTION_BUTTONS.COPY, ACTION_BUTTONS.COMPARE_INSTANCES];
  // Used to popup attributes for advanced search (i.e. SearchFilterComponent)
  schemaClassAttributes: string[] = [];
  // Flag to indicate if the advanced search component should be displayed
  needAdvancedSearch: boolean = false;

  // A flag to use route to load
  @Input() useRoute: boolean = false;
  // Use 20 so that the whole list can be seen without scrolling in a 4K monitor
  // 50 always needs scrolling.
  @Input() pageSize: number = 20;
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

  // So that we can remove subscription
  private subscription: Subscription = new Subscription

  constructor(private dataService: DataService,
    private router: Router,
    private referrersDialogService: ReferrersDialogService,
    private deletionDialogService: DeletionDialogService,
    private store: Store,
    private instUtils: InstanceUtilities,
    private listInstancesDialogService: ListInstancesDialogService) {
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  ngOnInit(): void {
    const sub = combineLatest([
      this.store.select(deleteInstances()),
      this.store.select(newInstances())
    ]).subscribe(([deletedInstances, newInstances]) => {
      if (!this.data)
        return
      if (!deletedInstances)
        deletedInstances = [];
      if (!newInstances)
        newInstances = [];
      const deletedDbIds = deletedInstances.map(inst => inst.dbId);
      const newDbIds = newInstances.map(inst => inst.dbId);
      const preCount = this.data.length;
      this.data = this.data.filter(inst => {
        if (inst.dbId > 0 && !deletedDbIds.includes(inst.dbId))
          return true;
        if (inst.dbId < 0 && newDbIds.includes(inst.dbId))
          return true;
        return false;
      })
      // Update the total instance count
      // Note: for the time being, the page size is fixed
      this.instanceCount = this.instanceCount - (preCount - this.data.length);
    });

    this.subscription.add(sub);
  }

  /**
   * Load the instances directly by calling the data service. Before call this method,
   * make sure className has been specified.
   */
  loadInstances() {
    // Make sure className is set!
    if (this.className && this.className.length > 0) 
      
      this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey)
        .subscribe((instancesList) => {
          this.displayInstances(instancesList);
          this.showProgressSpinner = false;
        }
        )
      

        if(this.dataService.isEventClass(this.className))
          this.secondaryActionButtons = [ACTION_BUTTONS.COPY, ACTION_BUTTONS.COMPARE_INSTANCES, ACTION_BUTTONS.SHOW_TREE];
        else {
          this.secondaryActionButtons = [ACTION_BUTTONS.COPY, ACTION_BUTTONS.COMPARE_INSTANCES];
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

  doBasicSearch(skip: number) {
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
    let skip = pageObject.pageIndex * pageObject.pageSize;
    // Page size may be changed. However, page index will be calculated
    // later on. 
    this.pageSize = pageObject.pageSize;
    // In these two cases, the basic (simple) search is used
    if (!this.needAdvancedSearch || this.searchCriteria.length === 0)
      this.doBasicSearch(skip);
    else // Otherwise, advanced search
      this.doAdvancedSearch(skip);
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId
    this.clickEvent.emit(row)
  }

  handleAction(actionEvent: { instance: Instance, action: string }) {
    switch (actionEvent.action) {
      case ACTION_BUTTONS.LAUNCH.name: {
        const dbId = actionEvent.instance.dbId;
        // As of October 15, don't use view only
        window.open(`schema_view/instance/${dbId}`, '_blank');
        // window.open(`schema_view/instance/${dbId}?${ViewOnlyService.KEY}=true`, '_blank');
        break;
      }
      case ACTION_BUTTONS.DELETE.name: {
        this.deletionDialogService.openDialog(actionEvent.instance);
        break;
      }
      case ACTION_BUTTONS.LIST.name: {
        this.referrersDialogService.openDialog(actionEvent.instance);
        break;
      }

      case ACTION_BUTTONS.COPY.name: {
        this.cloneInstance(actionEvent.instance);
        break;
      }

      case ACTION_BUTTONS.COMPARE_INSTANCES.name: {
        const matDialogRef =
        this.listInstancesDialogService.openDialog({schemaClassName: actionEvent.instance.schemaClassName, 
          title: "Compare " + actionEvent.instance.displayName + " to"});
        matDialogRef.afterClosed().subscribe((result) => {
          this.router.navigate(["/schema_view/instance/" + actionEvent.instance.dbId.toString() + "/comparison/" + result?.dbId.toString()]);
        });
        break;
      }

      case ACTION_BUTTONS.SHOW_TREE.name: {
        if(actionEvent.instance.schemaClassName)
          this.router.navigate(["/event_view/instance/" + actionEvent.instance.dbId]);
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

    resetSearchCriteria() {
      this.searchCriteria.length = 0; // reset it
    }

  private updateAdvancedSearchKey() {
    // Reset from the scratch
    let text = '';
    for (let criterium of this.searchCriteria) {
      if (text.length > 0)
        text += ' '; // give it an extra space
      text += this.convertCriterumToText(criterium);
    }
    this.advancedSearchKey = text;
  }

  private convertCriterumToText(criterium: SearchCriterium) {
    let text = '';
    text += "(" + criterium.attributeName + "[" + criterium.operand;
    if (!criterium.operand.includes('NULL') && criterium.searchKey && criterium.searchKey.length > 0)
      text += ": " + criterium.searchKey;
    text += "])";
    return text;
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
      // Use 'null' to make the Java backend happy. Basically
      // we don't care what it is as long as there is something.
      criterium.searchKey = 'null';
    }
    // Check if the passed critierium is listed already. There is no need
    // to list twice
    const newText = this.convertCriterumToText(criterium);
    for (let exited of this.searchCriteria) {
      if (this.convertCriterumToText(exited) === newText)
        return false; // This one has existed already. Don't add it any more.
    }
    return true;
  }

  toggleSearchMode() {
    this.needAdvancedSearch = !this.needAdvancedSearch;
    // Automatically perform a search based on the current condition
    // so that we can keep the consistent results (e.g. don't show advanced search results
    // in basic search or vice versa)
    if (this.needAdvancedSearch)
      this.doAdvancedSearch(0);
    else
      this.doBasicSearch(0); // Start from 0 in case not many
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
  doAdvancedSearch(skip: number) {
    if (this.searchCriteria.length === 0)
      return; // Just in case
    this.skip = skip;
    // Need attributes, operands and keys separate
    let attributes: string[] = [];
    let operands: string[] = [];
    let searchKeys: string[] = [];
    this.searchCriteria.forEach(criterium => {
      attributes.push(criterium.attributeName);
      operands.push(criterium.operand);
      if (criterium.searchKey)
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
  private searchInstances(attributeNames: string[],
    operands: string[],
    searchKeys: string[]
  ) {
    this.showProgressSpinner = true;
    this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributeNames, operands, searchKeys)
      .subscribe(instanceList => {
        this.displayInstances(instanceList);
        this.showProgressSpinner = false;
      })
  }

  navigateUrl(instance: Instance) {
    if (!this.isSelection)
      this.router.navigate(["/schema_view/instance/" + instance.dbId.toString()])
  }

  cloneInstance(instance: Instance) {
    this.dataService.cloneInstance(instance).subscribe(instance => {
      this.dataService.registerInstance(instance);
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtils.makeShell(instance)));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/schema_view/instance/" + dbId.toString()]);
    });
  }
}
