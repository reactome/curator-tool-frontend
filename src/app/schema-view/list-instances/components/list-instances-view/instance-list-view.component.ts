import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { PageEvent } from "@angular/material/paginator";
import { SearchCriterium, Instance, InstanceList, SelectedInstancesList } from "../../../../core/models/reactome-instance.model";
import { DataService } from "../../../../core/services/data.service";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { ReferrersDialogService } from "../../../../instance/components/referrers-dialog/referrers-dialog.service";
import { DeletionDialogService } from "../../../../instance/components/deletion-dialog/deletion-dialog.service";
import { Store } from '@ngrx/store';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { ACTION_BUTTONS } from 'src/app/core/models/reactome-schema.model';
import { ActionButton } from './instance-list-table/instance-list-table.component';
import { ListInstancesDialogService } from '../list-instances-dialog/list-instances-dialog.service';
import { BatchEditDialogService } from './batch-edit-dialog/batch-edit-dialog-service';
import { deleteInstances, newInstances, updatedInstances } from 'src/app/instance/state/instance.selectors';
import { combineLatest, map, Observable, Subscription, take } from 'rxjs';
import { DeleteBulkDialogService } from '../delete-bulk-dialog/delete-bulk-dialog.service';

@Component({
  selector: 'app-instance-list-view',
  templateUrl: './instance-list-view.component.html',
  styleUrls: ['./instance-list-view.component.scss'],
})
export class InstanceListViewComponent implements OnInit, OnDestroy {
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
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.LAUNCH, ACTION_BUTTONS.DELETE, ACTION_BUTTONS.LIST];
  secondaryActionButtons: Array<ActionButton> = [ACTION_BUTTONS.COPY, ACTION_BUTTONS.COMPARE_INSTANCES];
  // Used to popup attributes for advanced search (i.e. SearchFilterComponent)
  schemaClassAttributes: string[] = [];
  // Flag to indicate if the advanced search component should be displayed
  needAdvancedSearch: boolean = false;
  selectedInstances: Instance[] = [];
  deletedDBIds: number[] = [];
  updatedDBIds: number[] = [];

  @Input() isLocal: boolean = false;
  @Input() showBatchEdit: boolean = true;
  @Input() showDeletion: boolean = true;

  // A flag to use route to load
  @Input() useRoute: boolean = true;
  // Use 20 so that the whole list can be seen without scrolling in a 4K monitor
  // 50 always needs scrolling.
  @Input() pageSize: number = 20;
  // A flag to indicate this selection is used for editing
  @Input() isSelection: boolean = false;

  @Output() clickEvent = new EventEmitter<Instance>();

  @Input() set setClassName(inputClassName: string) {
    setTimeout(() => {
      // this.useRoute = false;
      this.className = inputClassName;
      this.skip = 0;
      this.showProgressSpinner = true;
      this.loadInstances();
      this.loadSchemaClassAttributes();
    }); // Delay to avoid the 'NG0100: ExpressionChangedAfterItHasBeenChecked' error
  }

  // So that we can remove subscription
  private subscription: Subscription = new Subscription();

  constructor(private dataService: DataService,
    private router: Router,
    private route: ActivatedRoute,
    private referrersDialogService: ReferrersDialogService,
    private deletionDialogService: DeletionDialogService,
    private store: Store,
    private instUtils: InstanceUtilities,
    private listInstancesDialogService: ListInstancesDialogService,
    private batchEditDialogService: BatchEditDialogService,
    private deleteBulkDialogService: DeleteBulkDialogService) {
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  ngOnInit(): void {
    if (this.useRoute) {
      // Delay to avoid the 'NG0100: ExpressionChangedAfterItHasBeenChecked' error
      setTimeout(() => {
        combineLatest([this.route.params, this.route.queryParams]).subscribe(
          ([params, queryParams]) => this.handleRoute(params, queryParams)
        );
      })
    }
    this.loadInstances();
    this.getSelectedInstances();
    this.checkStoreData();

  }

  /**
   * Load the instances directly by calling the data service. Before call this method,
   * make sure className has been specified.
   */
  loadInstances() {
    // Make sure className is set!
    if (this.className && this.className.length > 0)
      if (this.isLocal) {
        combineLatest([
          this.store.select(updatedInstances()).pipe(take(1)),
          this.store.select(newInstances()).pipe(take(1)),
          this.store.select(deleteInstances()).pipe(take(1))
        ]).subscribe(([updated, newlyCreated, deleted]) => {
          // Only include instances with matching className
          const filteredUpdated = updated.filter(inst => this.instUtils.isSchemaClass(inst, this.className, this.dataService));
          const filteredNew = newlyCreated.filter(inst => this.instUtils.isSchemaClass(inst, this.className, this.dataService));
          const filteredDeleted = deleted.filter(inst => this.instUtils.isSchemaClass(inst, this.className, this.dataService));

          // Optionally filter by displayName if searchKey is set
          const filterBySearchKey = (arr: Instance[]) => {
            if (this.searchKey && this.searchKey.trim().length > 0) {
              const key = this.searchKey.trim().toLowerCase();
              return arr.filter(inst => inst.displayName && inst.displayName.toLowerCase().includes(key));
            }
            return arr;
          };

          const filteredUpdatedByKey = filterBySearchKey(filteredUpdated);
          const filteredNewByKey = filterBySearchKey(filteredNew);
          const filteredDeletedByKey = filterBySearchKey(filteredDeleted);

          // Combine: updated, new, and deleted instances, ensuring uniqueness by dbId
          const instanceMap = new Map<number, Instance>();
          [...filteredUpdatedByKey, ...filteredNewByKey, ...filteredDeletedByKey].forEach(inst => {
            instanceMap.set(inst.dbId, inst);
          });
          const combined = Array.from(instanceMap.values());

          // Apply skip and limit
          const paged = combined.slice(this.skip, this.skip + this.pageSize);

          const localInstList: InstanceList = {
            instances: paged,
            totalCount: combined.length
          };
          this.displayInstances(localInstList);
          this.showProgressSpinner = false;
        });
      }
      else {
        console.debug(this.searchKey);
        this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey)
          .subscribe((instancesList) => {
            this.displayInstances(instancesList);
            this.showProgressSpinner = false;
          });
      }

    if (this.dataService.isEventClass(this.className))
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

  private checkStoreData() {

    let subscription = this.instUtils.deletedDbId$.subscribe(dbId => {
      let deletedInst = this.data.find(inst => inst.dbId === dbId);
      if (deletedInst) {
        this.data = this.data.filter(inst => inst.dbId !== dbId);
      }
    });
    this.subscription.add(subscription);

    // When an instance is reset from deleted state, it should re-appear in the local list instances view
    subscription = this.instUtils.resetDeletedDbId$.subscribe(dbId => {
      if (this.isLocal) {
        let updatedInsts = this.store.select(updatedInstances()).pipe(take(1)).subscribe(instances => {

          if (dbId && !instances.find(inst => inst.dbId === dbId)) {
            this.data = this.data.filter(inst => inst.dbId !== dbId);
          }
        })

      }
    });
    this.subscription.add(subscription);

    // New instances are only shown in the local list instances view, so no need to update other views.
    // This new instance will need to be removed from this view to indicate that it has been committed.
    subscription = this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newDbId]) => {
      let newInst = this.data.find(inst => inst.dbId === oldDbId);
      if (newInst) {
        this.data = this.data.filter(inst => inst.dbId !== oldDbId);
      }
    });
    this.subscription.add(subscription);

    // After committing an instance, the display name may have changed, so refresh the view.
    subscription = this.instUtils.refreshViewDbId$.subscribe(dbId => {
      this.loadInstances();
    });
    this.subscription.add(subscription);

    // For new instances in local list instances view, the display name may have changed, so refresh the view.
    subscription = combineLatest([
      this.store.select(newInstances()),
      this.store.select(updatedInstances())
    ]).subscribe(([newInsts, updatedInsts]) => {
      if ((newInsts && newInsts.length > 0) || (updatedInsts && updatedInsts.length > 0)) {
        const newMap = new Map<number, Instance>();
        newInsts?.forEach(i => newMap.set(i.dbId, i));
        if (this.isLocal) // Only update display name in local list instances view
          updatedInsts?.forEach(i => newMap.set(i.dbId, i));
        this.data = this.data.map(inst => {
          const matched = newMap.get(inst.dbId);
          return matched ? { ...inst, displayName: matched.displayName } : inst;
        });
      }
    });
    this.subscription.add(subscription);


  }

  /**
   * Load the schema class for this instance list so that we can do attribute-based
   * search.
   */
  loadSchemaClassAttributes() {
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
      console.debug(this.searchKey);
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
          this.listInstancesDialogService.openDialog({
            schemaClass: actionEvent.instance.schemaClass!,
            title: "Compare " + actionEvent.instance.displayName + " to"
          });
        matDialogRef.afterClosed().subscribe((result) => {
          this.router.navigate(["/schema_view/instance/" + actionEvent.instance.dbId.toString() + "/comparison/" + result?.dbId.toString()]);
        });
        break;
      }

      case ACTION_BUTTONS.SHOW_TREE.name: {
        if (actionEvent.instance.schemaClassName)
          this.router.navigate(["/event_view/instance/" + actionEvent.instance.dbId]);
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
    let url = '';
    if (this.isLocal)
      url = '/schema_view/local_list_instances/' + this.className + '/' + this.skip + '/' + this.pageSize;
    else
      url = '/schema_view/list_instances/' + this.className + '/' + this.skip + '/' + this.pageSize;
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

    if (this.isLocal) {
      this.advancedSearchForLocalInstances(attributeNames, operands, searchKeys);
    }
    else {
      this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributeNames, operands, searchKeys)
        .subscribe(instanceList => {
          this.displayInstances(instanceList);
          this.showProgressSpinner = false;
        })
    }

  }

  advancedSearchForLocalInstances(
    attributeNames: string[],
    operands: string[],
    searchKeys: string[]) {
    combineLatest([
      this.store.select(updatedInstances()).pipe(take(1)),
      this.store.select(newInstances()).pipe(take(1)),
      this.store.select(deleteInstances()).pipe(take(1))
    ]).subscribe(([updated, newlyCreated, deleted]) => {
      // Only include instances with matching className
      const filteredUpdated = updated.filter(inst => inst.schemaClassName === this.className);
      const filteredNew = newlyCreated.filter(inst => inst.schemaClassName === this.className);
      const filteredDeleted = deleted.filter(inst => inst.schemaClassName === this.className);

      const filterByAdvancedCriteria = (arr: Instance[]) => {
        if (
          attributeNames.length === 0 ||
          operands.length !== attributeNames.length ||
          searchKeys.length !== attributeNames.length
        ) {
          return arr;
        }

        return arr.filter(inst => {
          // For each criterium, check if the instance matches
          return attributeNames.every((attrName: string, i: number) => {
            const operand = operands[i];
            const pattern = searchKeys[i];
            let value: any;
            this.getAttributeValue(inst, attrName).subscribe(val => {
              value = val;
            });

            // TODO: this is a bug, will never check the null case
            //if (value == null) return;

            if (Array.isArray(value)) {
              // Check each element in the array
              if (value.some(val => this.checkOperand(val, operand, pattern))) {
                return inst;
              };
            } else {
              // Single value
              if (this.checkOperand(value, operand, pattern)) {
                return inst;
              }
            }
            return false;
          });
        });
      };

      const filteredUpdatedByKey = filterByAdvancedCriteria(filteredUpdated);
      const filteredNewByKey = filterByAdvancedCriteria(filteredNew);
      const filteredDeletedByKey = filterByAdvancedCriteria(filteredDeleted);

      // Combine: updated, new, and deleted instances
      const combined = [...filteredUpdatedByKey, ...filteredNewByKey, ...filteredDeletedByKey];

      // Apply skip and limit
      const paged = combined.slice(this.skip, this.skip + this.pageSize);

      const localInstList: InstanceList = {
        instances: paged,
        totalCount: combined.length
      };
      this.displayInstances(localInstList);
      this.showProgressSpinner = false;
    });
  }

  checkOperand(val: any, operand: string, pattern: string): boolean {
    const valStr = val != null ? val.toString().toLowerCase() : '';
    const patStr = pattern != null ? pattern.toString().toLowerCase() : '';

    switch (operand) {
      case 'Contains':
        return valStr.includes(patStr);
      case 'Equal':
        return valStr === patStr;
      case 'Not Equal':
        return valStr !== patStr;
      case 'IS NULL':
        return val == null || valStr === '';
      case 'IS NOT NULL':
        return val != null && valStr !== '';
      default:
        return false;
    }
  }

  // TODO: move this to instance utilities
  getAttributeValue(instance: Instance, attributeName: string): Observable<any> {
    return this.dataService.fetchInstance(instance.dbId).pipe(
      map((fullInstance) => {
        if (!fullInstance || !fullInstance.attributes) return null;
        let attributeValue = fullInstance.attributes.get(attributeName);
        if (!attributeValue) return null;

        if (Array.isArray(attributeValue)) {
          return attributeValue.map((value: any) =>
            this.instUtils.isInstance(value) ? value.displayName : value
          );
        } else {
          return this.instUtils.isInstance(attributeValue)
            ? attributeValue.displayName
            : attributeValue;
        }
      })
    );
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

  // TODO: need to clean this: either remove take one or update each time 
  // use combine latest to sync 
  handleBatchEdit() {
    if (this.needAdvancedSearch)
      this.doAdvancedSearch(0);
    else
      this.doBasicSearch(0);

    if (this.isLocal) {
      this.batchEditDialogService.openDialog(this.selectedInstances.length > 0 ? this.selectedInstances : this.data);
    }

    else {
      this.store.select(deleteInstances()).pipe(
        take(1),
        map((instances) => {
          this.deletedDBIds = instances.map(inst => inst.dbId);
        })
      )

      this.store.select(updatedInstances()).pipe(
        take(1),
        map((instances) => {
          this.updatedDBIds = instances.map(inst => inst.dbId);
        })
      )

      const filteredData = this.data.filter(
        inst => !this.deletedDBIds.includes(inst.dbId) && !this.updatedDBIds.includes(inst.dbId)
      );
      this.batchEditDialogService.openDialog(this.selectedInstances.length > 0 ? this.selectedInstances : filteredData);
    }
  }

  onSelectionChange(instance: Instance) {
    if (this.instUtils.isInstanceSelected(SelectedInstancesList.mainInstanceList, instance)) {
      this.instUtils.removeSelectedInstance(SelectedInstancesList.mainInstanceList, instance);
    } else {
      this.instUtils.addSelectedInstance(SelectedInstancesList.mainInstanceList, instance);
    }
  }

  handleDeleteSelected() {
    this.instUtils.getSelectedInstances(SelectedInstancesList.mainInstanceList).pipe(take(1)).subscribe(selectedInstances => {
      if (selectedInstances.length === 0) return;
      this.deleteBulkDialogService.openDialog(selectedInstances);
      this.instUtils.clearSelectedInstances(SelectedInstancesList.mainInstanceList);
      if (this.needAdvancedSearch)
        this.doAdvancedSearch(0);
      else
        this.doBasicSearch(0);
    });
  }

  isInstanceSelected(instance: Instance): boolean {
    return this.instUtils.isInstanceSelected(SelectedInstancesList.mainInstanceList, instance);
  }

  getSelectedInstances() {
    this.instUtils.getSelectedInstances(SelectedInstancesList.mainInstanceList).subscribe(selectedInstances => {
      this.selectedInstances = selectedInstances;
    });
  }

  setSelectedInstances() {
    this.instUtils.addSelectedInstances(SelectedInstancesList.mainInstanceList, this.data);
  }

  clearSelectedInstances() {
    this.instUtils.clearSelectedInstances(SelectedInstancesList.mainInstanceList);
  }

  private handleRoute(params: Params, queryParams: Params) {
    if (this.router.url.includes('local_list_instances')) {
      this.isLocal = true;
    } else {
      this.isLocal = false;
    }
    if (params['skip'])
      this.skip = params['skip']; // Use whatever is default
    if (params['limit'])
      this.pageSize = params['limit'];
    if (queryParams['query']) {
      console.debug('query: ' + queryParams['query']);
      this.searchKey = queryParams['query'];
    }
    // Give it a little bit delay to avoid ng0100 error.
    this.className = params['className'];
    let isChangedChanged = this.className !== params['className'];
    this.className = params['className'];
    this.loadSchemaClassAttributes();
    if (queryParams['attributes'] && queryParams['operands'] && queryParams['searchKeys']) { // This is for search
      // Need to get attributes
      let attributes = queryParams['attributes'].split(',');
      let operands = queryParams['operands'].split(',');
      let searchKeys = queryParams['searchKeys'].split(',');
      this.resetSearchCriteria();
      for (let i = 0; i < attributes.length; i++) {
        const criterium: SearchCriterium = {
          attributeName: attributes[i],
          operand: operands[i],
          searchKey: searchKeys[i] == 'null' ? '' : searchKeys[i]
        };
        this.addSearchCriterium(criterium);
      }
      this.needAdvancedSearch = true;
      // disable use route for the time being
      const useRoute = this.useRoute;
      this.useRoute = false; // Regardless the original value, we need to turn it off
      this.doAdvancedSearch(this.skip);
      this.useRoute = useRoute; // set it back
    }
    else
      this.loadInstances();
    if (isChangedChanged) {
      this.loadSchemaClassAttributes();
      // Clear out selected instances when class changes
      this.instUtils.clearSelectedInstances(SelectedInstancesList.mainInstanceList);
    } // Need to force to reload attributes there.

  }

    compareInstances() {
        this.router.navigate(["/schema_view/instance/" + this.selectedInstances[0].dbId.toString() + "/comparison/" + this.selectedInstances[1].dbId.toString()]);
    }
}
