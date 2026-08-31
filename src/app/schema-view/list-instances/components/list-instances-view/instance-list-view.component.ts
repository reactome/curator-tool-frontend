import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { PageEvent } from "@angular/material/paginator";
import { SearchCriterium, Instance, InstanceList, MAX_STAGED_INSTANCES, SelectedInstancesList } from "../../../../core/models/reactome-instance.model";
import { DataService } from "../../../../core/services/data.service";
import { MatchResolutionService } from "../../../../core/services/match-resolution.service";
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
import { catchError, combineLatest, forkJoin, map, Observable, of, Subscription, take } from 'rxjs';
import { DeleteBulkDialogService } from '../delete-bulk-dialog/delete-bulk-dialog.service';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import { InstanceNameGenerator } from 'src/app/core/post-edit/InstanceNameGenerator';
import { PageTitleService } from 'src/app/core/services/page-title.service';

/**
 * The choices offered by the species quick filter. 'all' means no filtering at all, and is
 * what a list starts out with.
 */
export type SpeciesFilter = 'all' | 'human' | 'nonhuman';

/** The attribute the quick filter works on. Classes without it don't get the filter. */
const SPECIES_ATTRIBUTE = 'species';

/** The display name of the human species instance, as it is stored in the database. */
const HUMAN_SPECIES_NAME = 'Homo sapiens';

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
  @Input() actionButtons: Array<ActionButton> = [ACTION_BUTTONS.LAUNCH, ACTION_BUTTONS.DELETE, ACTION_BUTTONS.LIST];
  @Input() needSecondaryActions: boolean = true;
  secondaryActionButtons: Array<ActionButton> = [];
  // Used to popup attributes for advanced search (i.e. SearchFilterComponent)
  schemaClassAttributes: string[] = [];
  // Flag to indicate if the advanced search component should be displayed
  needAdvancedSearch: boolean = false;
  selectedInstances: Instance[] = [];
  deletedDBIds: number[] = [];
  updatedDBIds: number[] = [];
  hasExecutedSearch: boolean = false;
  // The species quick filter, and whether the class on display can be filtered by it at all.
  // The filter narrows whatever the list is already showing, so it applies on top of both a
  // simple search and a set of advanced search conditions.
  speciesFilter: SpeciesFilter = 'all';
  hasSpeciesAttribute: boolean = false;

  @Input() isLocal: boolean = false;
  @Input() showBatchEdit: boolean = true;
  @Input() showDeletion: boolean = true;
  @Input() showBatchEditActions: boolean = true; // This is used to control the visibility of batch edit actions, which is only shown when there are selected instances. It is set to true by default, but can be turned off in the batch edit dialog.

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
      // The attributes have to be known before the instances are asked for: whether the new
      // class can be filtered by species at all decides which query is sent.
      this.loadSchemaClassAttributes().subscribe(() => this.loadInstances());
    }); // Delay to avoid the 'NG0100: ExpressionChangedAfterItHasBeenChecked' error
  }

  // To show information
  readonly dialog = inject(MatDialog);

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
    private deleteBulkDialogService: DeleteBulkDialogService,
    private matchResolutionService: MatchResolutionService,
    private pageTitleService: PageTitleService) {
  }

  ngOnDestroy(): void {
    this.clearSelectedInstances();
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
        const loadInstanceSubject = this.dataService.getLoadInstanceSubject();
        if (loadInstanceSubject) {
          loadInstanceSubject.pipe(take(1)).subscribe(() => this.loadLocalInstancesFromStore());
        }
        else {
          this.loadLocalInstancesFromStore();
        }
      }
      else {
        // console.debug(this.searchKey);
        this.fetchInstancesForBasicSearch(this.skip, this.pageSize)
          .subscribe((instancesList) => {
            this.displayInstances(instancesList);
            this.showProgressSpinner = false;
          });
      }
    if (this.needSecondaryActions) {
      if (this.dataService.isEventClass(this.className))
        this.secondaryActionButtons = [ACTION_BUTTONS.COPY, ACTION_BUTTONS.COMPARE_INSTANCES, ACTION_BUTTONS.TIMELINE];
      else {
        this.secondaryActionButtons = [ACTION_BUTTONS.COPY, ACTION_BUTTONS.COMPARE_INSTANCES];
      }
      // For ReferenceGeneProducts, allow creating an EntityWithAccessionedSequence from them.
      if (this.dataService.isReferenceGeneProductClass(this.className))
        this.secondaryActionButtons = [...this.secondaryActionButtons, ACTION_BUTTONS.CREATE_EWAS];
    }
  }

  private loadLocalInstancesFromStore() {
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

      this.displayLocalInstances(combined);
    });
  }

  /**
   * Apply the species quick filter, page, and display a set of staged instances. Both the
   * plain listing and the advanced search over staged instances end here, so the filter is
   * applied in exactly one place for either of them.
   */
  private displayLocalInstances(instances: Instance[]) {
    this.filterLocalInstancesBySpecies(instances).subscribe(filtered => {
      // Apply skip and limit
      const paged = filtered.slice(this.skip, this.skip + this.pageSize);

      const localInstList: InstanceList = {
        instances: paged,
        totalCount: filtered.length
      };
      this.displayInstances(localInstList);
      this.showProgressSpinner = false;
    });
  }

  /**
   * The staged-instance counterpart of the species condition sent to the server. It is done
   * here rather than through the generic condition matching so that the two agree on the
   * awkward case: an instance with no species at all belongs to neither the human nor the
   * non-human list.
   */
  private filterLocalInstancesBySpecies(instances: Instance[]): Observable<Instance[]> {
    if (!this.isSpeciesFilterActive() || instances.length === 0)
      return of(instances);
    return forkJoin(
      // One instance whose species cannot be read is treated as having none rather than
      // being allowed to fail the whole listing.
      instances.map(inst => this.getAttributeValue(inst, SPECIES_ATTRIBUTE).pipe(
        take(1),
        catchError(() => of(null))
      ))
    ).pipe(
      map(values => instances.filter((_, i) => this.matchesSpeciesFilter(values[i])))
    );
  }

  private matchesSpeciesFilter(value: any): boolean {
    const names: string[] = (Array.isArray(value) ? value : [value])
      .filter(name => name != null)
      .map(name => name.toString());
    if (this.speciesFilter === 'human')
      return names.some(name => name === HUMAN_SPECIES_NAME);
    return names.some(name => name !== HUMAN_SPECIES_NAME);
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
   * search. The returned observable completes once the attributes are in place, so that a
   * caller that needs to know about them (e.g. whether this class has a species attribute)
   * can wait for it. The class is cached by the data service, so subscribing is cheap.
   */
  loadSchemaClassAttributes(): Observable<string[]> {
    if (!this.className || this.className.length === 0)
      return of(this.schemaClassAttributes);
    return this.dataService.fetchSchemaClass(this.className).pipe(
      take(1),
      map(cls => {
        if (cls && cls.attributes) {
          // Make a copy and then sort
          let attributes = [...cls.attributes];
          attributes.sort((a, b) => a.name.localeCompare(b.name));
          this.schemaClassAttributes.length = 0; // Empty it first
          attributes.forEach(attr => {
            this.schemaClassAttributes.push(attr.name);
          });
        }
        this.hasSpeciesAttribute = this.schemaClassAttributes.includes(SPECIES_ATTRIBUTE);
        // A filter carried over from a class that does have species would otherwise keep
        // narrowing the list with no control on screen to switch it off again.
        if (!this.hasSpeciesAttribute)
          this.speciesFilter = 'all';
        return this.schemaClassAttributes;
      })
    );
  }

  /**
   * Switch the species quick filter and reload the list. The filter is applied on top of
   * whatever search is currently in effect rather than replacing it.
   */
  onSpeciesFilterChange(filter: SpeciesFilter) {
    if (this.speciesFilter === filter)
      return;
    this.speciesFilter = filter;
    this.showProgressSpinner = true;
    // With advanced conditions in play the advanced search has to be re-run so they are
    // kept; otherwise (including advanced mode with no conditions yet) the simple path
    // already knows how to send a species-only query.
    if (this.needAdvancedSearch && this.searchCriteria.length > 0)
      this.doAdvancedSearch(0);
    else
      this.doBasicSearch(0);
  }

  isSpeciesFilterActive(): boolean {
    return this.hasSpeciesAttribute && this.speciesFilter !== 'all';
  }

  /**
   * The species quick filter expressed as an ordinary search condition, which is how it
   * reaches the server. 'Not Equal' on a relationship attribute asks for an instance that
   * has a species other than human, so an instance with no species at all is in neither
   * the human nor the non-human list.
   */
  private getSpeciesCriterium(): SearchCriterium | undefined {
    if (!this.isSpeciesFilterActive())
      return undefined;
    return {
      attributeName: SPECIES_ATTRIBUTE,
      operand: this.speciesFilter === 'human' ? 'Equal' : 'Not Equal',
      searchKey: HUMAN_SPECIES_NAME
    };
  }

  private parseSpeciesFilter(value: any): SpeciesFilter {
    return (value === 'human' || value === 'nonhuman') ? value : 'all';
  }

  doBasicSearch(skip: number) {
    this.skip = skip;
    this.hasExecutedSearch = this.isBasicSearchActive() || this.isSpeciesFilterActive();
    if (this.useRoute) {
      let url = this.getListInstancesURL();
      const queryParams: Params = {};
      if (this.searchKey && this.searchKey.trim().length > 0)
        queryParams['query'] = this.searchKey.trim();
      // Carried in the URL so the filter survives a reload or a shared link, the same as
      // the search term does.
      if (this.isSpeciesFilterActive())
        queryParams['species'] = this.speciesFilter;
      if (Object.keys(queryParams).length > 0)
        this.router.navigate([url], { queryParams: queryParams });
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
        let schemaClass = this.dataService.getSchemaClass(actionEvent.instance.schemaClassName)
        const matDialogRef =
          this.listInstancesDialogService.openDialog({
            schemaClass: schemaClass,
            title: "Compare " + actionEvent.instance.displayName + " to"
          });
        matDialogRef.afterClosed().subscribe((result) => {
          if (result)
            this.router.navigate(["/schema_view/instance/" + actionEvent.instance.dbId.toString() + "/comparison/" + result?.dbId.toString()]);
        });
        ;
        break;
      }

      case ACTION_BUTTONS.TIMELINE.name: {
        if (actionEvent.instance.schemaClassName)
          this.router.navigate(["/event_view/instance/" + actionEvent.instance.dbId]);
        break;
      }

      case ACTION_BUTTONS.CREATE_EWAS.name: {
        this.createEwasFromReferenceGeneProduct(actionEvent.instance);
        break;
      }
    }
  }

  /**
   * Create a new EntityWithAccessionedSequence from a ReferenceGeneProduct, copying the
   * shared attributes (referenceEntity, species and names) over. This mirrors the
   * "Create EWAS from RefGeneProduct" action in the Java Curator Tool.
   */
  createEwasFromReferenceGeneProduct(instance: Instance) {
    // The list view only holds shell instances, so load the full ReferenceGeneProduct first.
    combineLatest([
      this.dataService.fetchInstance(instance.dbId),
      this.dataService.createNewInstance('EntityWithAccessionedSequence')
    ]).pipe(take(1)).subscribe(([refGeneProduct, ewas]) => {
      this.instUtils.copyAttributesFromRefGeneProductToEwas(ewas, refGeneProduct);
      // Generate the display name from the freshly copied names.
      new InstanceNameGenerator(this.dataService, this.instUtils).updateDisplayName(ewas);
      // Register the new instance and navigate to it, just like cloneInstance.
      this.dataService.registerInstance(ewas);
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtils.makeShell(ewas)));
      this.router.navigate(["/schema_view/instance/" + ewas.dbId.toString()]);
    });
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
   * Remove a specific search criterium (e.g. when its chip is dismissed).
   * Assign a new array reference so the chip list picks up the change.
   */
  removeSearchCriteriumAt(index: number) {
    if (index < 0 || index >= this.searchCriteria.length)
      return;
    this.searchCriteria = this.searchCriteria.filter((_, i) => i !== index);
    this.updateAdvancedSearchKey();
    if (this.searchCriteria.length === 0)
      this.hasExecutedSearch = false;
  }

  /**
   * Perform advance search.
   */
  doAdvancedSearch(skip: number) {
    if (this.searchCriteria.length === 0) {
      this.hasExecutedSearch = false;
      return; // Just in case
    }
    this.skip = skip;
    this.hasExecutedSearch = true;
    // Need attributes, operands and keys separate. The species quick filter is deliberately
    // left out here: it is its own control rather than one of the curator's conditions, so
    // it travels as its own query parameter and is added back on the way to the server.
    const { attributes, operands, searchKeys } = this.toSearchParams(this.searchCriteria);

    if (this.useRoute) {
      let url = this.getListInstancesURL();
      const queryParams: Params = {
        attributes: attributes.toString(),
        operands: operands.toString(),
        // An array becomes a repeated query parameter, keeping terms that contain a
        // comma intact instead of splitting them apart on the way back in.
        searchKeys: searchKeys
      };
      if (this.isSpeciesFilterActive())
        queryParams['species'] = this.speciesFilter;
      this.router.navigate([url], { queryParams: queryParams });
    }
    else
      this.searchInstances(this.searchCriteria);
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
   * @param criteria the conditions the curator built; the species quick filter, if one is
   * set, is added to them here.
   */
  private searchInstances(criteria: SearchCriterium[]) {
    this.showProgressSpinner = true;

    if (this.isLocal) {
      // Staged instances are filtered by species once the criteria have been applied, in
      // displayLocalInstances.
      const { attributes, operands, searchKeys } = this.toSearchParams(criteria);
      this.advancedSearchForLocalInstances(attributes, operands, searchKeys);
    }
    else {
      const { attributes, operands, searchKeys } = this.toSearchParams(this.withSpeciesFilter(criteria));
      this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributes, operands, searchKeys)
        .subscribe(instanceList => {
          this.displayInstances(instanceList);
          this.showProgressSpinner = false;
        })
    }

  }

  /**
   * The conditions actually sent to the server: the given ones plus the species quick
   * filter when it is set.
   */
  private withSpeciesFilter(criteria: SearchCriterium[]): SearchCriterium[] {
    const speciesCriterium = this.getSpeciesCriterium();
    return speciesCriterium ? [...criteria, speciesCriterium] : criteria;
  }

  /**
   * The request behind a simple (non-advanced) listing. Without a species filter this is
   * the plain listInstances call. With one, the two have to be combined into a single
   * attribute-based query, since listInstances takes a search term and nothing else: the
   * term is translated into the same condition the server would derive from it on its own,
   * a number being a dbId and anything else a displayName substring.
   */
  private fetchInstancesForBasicSearch(skip: number, limit: number): Observable<InstanceList> {
    if (!this.isSpeciesFilterActive())
      return this.dataService.listInstances(this.className, skip, limit, this.searchKey);
    const criteria = this.withSpeciesFilter(this.basicSearchAsCriteria());
    const { attributes, operands, searchKeys } = this.toSearchParams(criteria);
    return this.dataService.searchInstances(this.className, skip, limit, attributes, operands, searchKeys);
  }

  private basicSearchAsCriteria(): SearchCriterium[] {
    // In advanced mode the search box shows the accumulated conditions rather than a term
    // of its own, so there is nothing of the curator's to translate.
    if (this.needAdvancedSearch)
      return [];
    const key = this.searchKey?.trim();
    if (!key || key.length === 0)
      return [];
    return [/^\d+$/.test(key)
      ? { attributeName: 'dbId', operand: 'Equal', searchKey: key }
      : { attributeName: 'displayName', operand: 'Contains', searchKey: key }];
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

      this.displayLocalInstances(combined);
    });
  }

  checkOperand(val: any, operand: string, pattern: string): boolean {
    // Regex is handled before the values are folded to lower case: a pattern such as
    // \D or [A-Z] means something else entirely once it has been lower-cased.
    if (this.isRegexOperand(operand))
      return this.matchesRegex(val != null ? val.toString() : '', pattern);

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

  private isRegexOperand(operand: string): boolean {
    return !!operand && operand.toLocaleLowerCase() === 'regex';
  }

  /**
   * Match a value against a curator-supplied regular expression the same way the backend
   * does, so that a pattern gives the same results in the staged list as it does in the
   * database list. Cypher's =~ is a full match and case sensitive, so anchoring here and
   * leaving the case alone is what keeps the two in step; '.*' and '(?i)' are the
   * curator's job either way. JavaScript has no inline flag syntax, so a leading '(?i)'
   * is turned into the RegExp 'i' flag rather than left in the pattern, where it would
   * throw.
   */
  private matchesRegex(value: string, pattern: string): boolean {
    if (pattern == null || pattern.length === 0)
      return false;
    let body = pattern;
    let flags = '';
    if (body.startsWith('(?i)')) {
      body = body.substring('(?i)'.length);
      flags = 'i';
    }
    try {
      return new RegExp('^(?:' + body + ')$', flags).test(value);
    }
    catch (e) {
      // A pattern JavaScript cannot compile (e.g. a Java-only construct) matches nothing
      // locally rather than failing the whole listing; the database side of the same
      // search is evaluated by Neo4j and is unaffected.
      console.warn('Invalid regular expression in search: ' + pattern, e);
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
    if (!this.selectedInstances || this.selectedInstances.length === 0) {
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'No instances selected',
          message: 'Select one or more instances from the list to use in batch edit.',
          instanceInfo: ''
        }
      });
      return;
    }

    combineLatest([
      this.store.select(deleteInstances()),
      this.store.select(newInstances()),
      this.store.select(updatedInstances())
    ]).pipe(
      take(1),
      map(([deleted, created, updated]) => [
        ...(deleted || []),
        ...(created || []),
        ...(updated || [])
      ])
    ).subscribe((allInstances) => {
      // When the new, updated, and deleted Instances count total exceeds the allowed limit, show a warning message to encourage users to persist their changes.
      if (allInstances.length > MAX_STAGED_INSTANCES) {
        this.showBatchEdit = false;
        this.dialog.open(InfoDialogComponent, {
          data: {
            title: 'Too many changes',
            message: 'The number of changes exceeds the allowed limit. Please commit your changes before doing batch edit.',
            instanceInfo: ''
          }
        }).afterClosed().subscribe(() => {
          return;
        });
      }
      else {
        const stagedDisplayNameMap = new Map<number, string | undefined>();
        allInstances.forEach(inst => stagedDisplayNameMap.set(inst.dbId, inst.displayName));

        const sourceData = this.selectedInstances.map(selectedInst => {
          const currentDataInst = this.data.find(inst => inst.dbId === selectedInst.dbId);
          const displayName = stagedDisplayNameMap.get(selectedInst.dbId)
            ?? currentDataInst?.displayName
            ?? selectedInst.displayName;

          return {
            ...selectedInst,
            displayName
          };
        });

        if (this.isLocal) {
          this.batchEditDialogService.openDialog(sourceData);
          return;
        }

        combineLatest([
          this.store.select(deleteInstances()),
          this.store.select(updatedInstances())
        ]).pipe(take(1)).subscribe(([deleted, updated]) => {
          const deletedDbIds = new Set((deleted || []).map(inst => inst.dbId));
          const updatedDbIds = new Set((updated || []).map(inst => inst.dbId));
          // Only filter out deleted instances, updated instances should still be included in batch edit and the latest changes will be shown in the dialog.
          const filteredData = sourceData.filter(
            inst => !deletedDbIds.has(inst.dbId)
          );
          this.batchEditDialogService.openDialog(filteredData);
        });
      }
    })

  }

  onSelectionChange(instance: Instance) {
    if (this.isInstanceSelected(instance)) {
      this.selectedInstances = this.selectedInstances.filter(selected => selected.dbId !== instance.dbId);
      return;
    }
    this.selectedInstances = [...this.selectedInstances, instance];
  }

  onRowChecked(instance: Instance) {
    if (this.isInstanceSelected(instance)) {
      return;
    }
    this.selectedInstances = [...this.selectedInstances, instance];
  }

  onRowUnchecked(instance: Instance) {
    this.selectedInstances = this.selectedInstances.filter(selected => selected.dbId !== instance.dbId);
  }

  handleDeleteSelected() {
    if (this.selectedInstances.length === 0) return;
    this.deleteBulkDialogService.openDialog(this.selectedInstances);
    this.clearSelectedInstances();
    if (this.needAdvancedSearch)
      this.doAdvancedSearch(0);
    else
      this.doBasicSearch(0);
  }

  isInstanceSelected(instance: Instance): boolean {
    return this.selectedInstances.some(selected => selected.dbId === instance.dbId);
  }

  setSelectedInstances() {
    const selectedDbIds = new Set(this.selectedInstances.map(instance => instance.dbId));
    const instancesToAdd = this.data.filter(instance => !selectedDbIds.has(instance.dbId));
    this.selectedInstances = [...this.selectedInstances, ...instancesToAdd];
  }

  clearSelectedInstances() {
    this.selectedInstances = [];
  }

  downloadSelectedInstances() {
    if (!this.selectedInstances || this.selectedInstances.length === 0) return;

    const suggestedName = `${this.className || 'instances'}-selected.csv`;
    const providedName = window.prompt('Enter a file name for the CSV download.', suggestedName);
    if (providedName === null) return;

    const trimmedName = providedName.trim();
    const fileName = (trimmedName.length > 0 ? trimmedName : suggestedName).endsWith('.csv')
      ? (trimmedName.length > 0 ? trimmedName : suggestedName)
      : `${trimmedName.length > 0 ? trimmedName : suggestedName}.csv`;

    const csvContent = this.buildCsv(this.selectedInstances);
    this.triggerCsvDownload(fileName, csvContent);
  }

  downloadSearchResults() {
    if (this.isLocal || !this.hasExecutedSearch || this.instanceCount === 0) {
      return;
    }

    const suggestedName = `${this.className || 'instances'}-search-results.csv`;
    const providedName = window.prompt('Enter a file name for the CSV download.', suggestedName);
    if (providedName === null) {
      return;
    }

    const trimmedName = providedName.trim();
    const fileName = (trimmedName.length > 0 ? trimmedName : suggestedName).endsWith('.csv')
      ? (trimmedName.length > 0 ? trimmedName : suggestedName)
      : `${trimmedName.length > 0 ? trimmedName : suggestedName}.csv`;

    this.showProgressSpinner = true;
    const request = this.needAdvancedSearch && this.searchCriteria.length > 0
      ? this.fetchAllAdvancedSearchResults()
      : this.fetchInstancesForBasicSearch(0, this.instanceCount);

    request.subscribe({
      next: (instanceList) => {
        const csvContent = this.buildCsv(instanceList.instances);
        this.triggerCsvDownload(fileName, csvContent);
        this.showProgressSpinner = false;
      },
      error: () => {
        this.showProgressSpinner = false;
      }
    });
  }

  private handleRoute(params: Params, queryParams: Params) {
    this.hasExecutedSearch = false;
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
      this.hasExecutedSearch = true;
    }
    this.speciesFilter = this.parseSpeciesFilter(queryParams['species']);
    // Give it a little bit delay to avoid ng0100 error.
    this.className = params['className'];
    let isChangedChanged = this.className !== params['className'];
    this.className = params['className'];
    // Placed inside this route-params handler, not ngOnInit's top level: navigating between
    // classes (or between the database and staged list for the same class) reuses this
    // component instance rather than re-creating it, so only this handler re-fires per
    // navigation, not ngOnInit.
    this.pageTitleService.setTitle(`${this.className}@${this.isLocal ? 'Staged' : 'Database'}`);
    // Wait for the attributes: the species filter asked for in the URL is only honoured
    // once we know whether this class has a species attribute at all.
    this.loadSchemaClassAttributes().subscribe(() => this.loadForRoute(queryParams, isChangedChanged));
  }

  private loadForRoute(queryParams: Params, isChangedChanged: boolean) {
    if (this.isSpeciesFilterActive())
      this.hasExecutedSearch = true;
    if (queryParams['attributes'] && queryParams['operands'] && queryParams['searchKeys']) { // This is for search
      // Need to get attributes
      let attributes = queryParams['attributes'].split(',');
      let operands = queryParams['operands'].split(',');
      // searchKeys is one query parameter per term, so that a term containing a comma
      // (e.g. the regex a{2,3}) survives the round trip through the URL. A single term
      // arrives as a plain string rather than an array.
      const rawSearchKeys = queryParams['searchKeys'];
      let searchKeys: string[] = Array.isArray(rawSearchKeys) ? rawSearchKeys : [rawSearchKeys];
      this.resetSearchCriteria();
      for (let i = 0; i < attributes.length; i++) {
        const criterium: SearchCriterium = {
          attributeName: attributes[i],
          operand: operands[i],
          // Take the key as it came out of the URL. The 'null' placeholder belongs to the
          // NULL operands, and neither the condition chips nor the search box show a key
          // for those, so there is nothing to strip here; blanking it out instead threw
          // away a criterium whose term happened to be the text 'null'.
          searchKey: searchKeys[i] ?? ''
        };
        this.addSearchCriterium(criterium);
      }
      this.needAdvancedSearch = true;
      this.hasExecutedSearch = true;
      // disable use route for the time being
      const useRoute = this.useRoute;
      this.useRoute = false; // Regardless the original value, we need to turn it off
      this.doAdvancedSearch(this.skip);
      this.useRoute = useRoute; // set it back
    }
    else
      this.loadInstances();
    if (isChangedChanged) {
      this.loadSchemaClassAttributes().subscribe();
      // Clear out selected instances when class changes
      this.clearSelectedInstances();
    } // Need to force to reload attributes there.

  }

  compareInstances() {
    this.router.navigate(["/schema_view/instance/" + this.selectedInstances[0].dbId.toString() + "/comparison/" + this.selectedInstances[1].dbId.toString()]);
  }

  private isBasicSearchActive(): boolean {
    return !!this.searchKey && this.searchKey.trim().length > 0;
  }

  private toSearchParams(criteria: SearchCriterium[]): { attributes: string[]; operands: string[]; searchKeys: string[] } {
    let attributes: string[] = [];
    let operands: string[] = [];
    let searchKeys: string[] = [];
    criteria.forEach(criterium => {
      attributes.push(criterium.attributeName);
      operands.push(criterium.operand);
      // The three lists are zipped back together by position on the server, so every
      // criterium has to contribute exactly one key ('null' being the placeholder the
      // NULL operands carry). Leaving one out would shift the remaining keys onto the
      // wrong attributes, and a single key left standing for several attributes is
      // comma-split by the server, which tears a quantifier such as a{2,3} in half.
      // A Regex term is passed on verbatim: the match covers the whole value, so leading
      // and trailing spaces are part of the pattern rather than something to tidy up.
      const key = criterium.searchKey ?? '';
      searchKeys.push(this.isRegexOperand(criterium.operand) ? key : key.trim());
    });
    return { attributes, operands, searchKeys };
  }

  private fetchAllAdvancedSearchResults(): Observable<InstanceList> {
    const { attributes, operands, searchKeys } = this.toSearchParams(this.withSpeciesFilter(this.searchCriteria));
    return this.dataService.searchInstances(this.className, 0, this.instanceCount, attributes, operands, searchKeys);
  }

  private buildCsv(instances: Instance[]): string {
    const header = 'dbId,displayName,schemaClass';
    const rows = instances.map(instance => {
      const displayName = this.escapeCsvValue(instance.displayName ?? '');
      const schemaClass = this.escapeCsvValue(instance.schemaClassName ?? '');
      return `${instance.dbId},${displayName},${schemaClass}`;
    });
    return [header, ...rows].join('\n');
  }

  private escapeCsvValue(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private triggerCsvDownload(fileName: string, csvContent: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  /**
* Save the selected new instances via REST API (sequentially).
* Delegates to the shared implementation in InstanceUtilities so this view and
* the local instance list stay in sync.
*/
  commitNewInstances() {
    this.instUtils.commitNewInstances(this.selectedInstances, this.dataService, this.matchResolutionService, () => {
      this.selectedInstances = [];
      this.instUtils.clearSelectedInstances(SelectedInstancesList.newInstanceList);
    });
  }

}
