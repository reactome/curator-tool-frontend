import {
  CdkDragDrop,
  CdkDragEnter,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { PostEditListener } from 'src/app/core/post-edit/PostEditOperation';
import { PostEditService } from 'src/app/core/services/post-edit.service';
import { UpdateInstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import {
  SelectInstanceDialogService
} from 'src/app/schema-view/list-instances/components/select-instance-dialog/select-instance-dialog.service';
import {
  AttributeCategory,
  AttributeDataType,
  SchemaAttribute,
  STOICHIOMETRY_RELATIONSHIP_TYPES,
} from '../../../../core/models/reactome-schema.model';
import { DragDropService } from '../../../../schema-view/instance-bookmark/drag-drop.service';
import { NewInstanceDialogService } from '../../new-instance-dialog/new-instance-dialog.service';
import {
  DragDropStatus,
  DragHoverStatus,
  InstanceDataSource,
} from './instance-table.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeEditService } from 'src/app/core/services/attribute-edit.service';
import { deleteInstances } from 'src/app/instance/state/instance.selectors';
import { Subscription, catchError, of } from 'rxjs';
import { BookmarkActions } from 'src/app/schema-view/instance-bookmark/state/bookmark.actions';
import { AttributeValue, EDIT_ACTION } from 'src/app/core/models/reactome-instance.model';
import { InstanceComparisonDataSource } from './instance-table-comparison.model';
import { MatDialog } from '@angular/material/dialog';
import { StoichiometryDialogComponent } from './stoichiometry-dialog/stoichiometry-dialog.component';

/**
 * This is the actual table component to show the content of an Instance.
 */
@Component({
  selector: 'app-instance-table',
  templateUrl: './instance-table.component.html',
  styleUrls: ['./instance-table.component.scss'],
})
export class InstanceTableComponent implements PostEditListener {
  // Fire an event when this instance is edited
  @Output() editedInstance = new EventEmitter<Instance>();
  displayedColumns: string[] = ['name', 'value'];
  showFilterOptions: boolean = false;
  showHeaderActions: boolean = false;
  sortAttNames: boolean = true;
  sortAttDefined: boolean = false;
  filterEdited: boolean = false;
  @Input() blockRouter: boolean = false;
  // During new instance creation in a diagram, don't fire any event
  @Input() preventEvent: boolean = false;
  // Flag to block the table update during editing
  inEditing: boolean = false;
  referenceColumnTitle: string = 'Reference Value';
  valueColumnTitle: string = 'Value';

  categoryNames = Object.keys(AttributeCategory).filter((v) =>
    isNaN(Number(v))
  );
  categories: Map<AttributeCategory, boolean> = new Map<
    AttributeCategory,
    boolean
  >();
  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;

  // Data source for the table, can be either InstanceDataSource or InstanceComparisonDataSource
  instanceDataSource:
    | InstanceDataSource
    | InstanceComparisonDataSource = new InstanceDataSource(
      undefined,
      this.categories,
      this.sortAttNames,
      this.sortAttDefined,
      this.filterEdited
    );

  // Keep it for editing
  _instance?: Instance;

  // For comparison
  _referenceInstance?: Instance;
  showReferenceColumn: boolean = false;

  // For highlighting rows during drag/drop event-view
  dragDropStatus: DragDropStatus = {
    dragging: false,
    dropping: false,
    draggedInstance: undefined,
  };

  // Name of the attribute whose value cell the cursor is over during a bookmark drag, and whether
  // the dragged instance is accepted there. Held at the table level so the highlight can cover the
  // whole slot; the values themselves report their hover state via (dragHover).
  private dragHoverAttribute: string | undefined;
  private dragHoverDroppable: boolean = false;

  // To check if a value has been deleted
  deletedDBIds: number[] = [];

  /**
   * Whether the current instance has a populated stableIdentifier attribute. Used to decide whether
   * the species-edit warning should be shown.
   */
  hasStableIdentifier(): boolean {
    const stableId = this._instance?.attributes?.get('stableIdentifier');
    return stableId !== undefined && stableId !== null;
  }

  // Make sure it is bound to input instance
  @Input() set instance(instance: Instance | undefined) {
    if (this.inEditing)
      return; // In editing now. Nothing to change from outside.
    this._instance = instance;
    this.updateTableContent();
  }

  @Input() set referenceInstance(refInstance: Instance | undefined) {
    this.setReferenceInstance(refInstance!);
  }

  // Track subscriptions added so that we can remove them
  private subscriptions: Subscription = new Subscription()

  constructor(
    private cdr: ChangeDetectorRef,
    private dialogService: NewInstanceDialogService,
    private dragDropService: DragDropService,
    private selectInstanceDialogService: SelectInstanceDialogService,
    private store: Store,
    private instUtil: InstanceUtilities,
    private attributeEditService: AttributeEditService,
    private postEditService: PostEditService, // This is used to perform post-edit actions
    private dataService: DataService,
    private dialog: MatDialog,
  ) {
    for (let category of this.categoryNames) {
      let categoryKey = category as keyof typeof AttributeCategory;
      this.categories.set(AttributeCategory[categoryKey], true);
    }

    this.dragDropService.register('instance-table');

    let subscription = this.store.select(deleteInstances()).subscribe(instances => {
      this.deletedDBIds = instances.map(inst => inst.dbId);
    });
    this.subscriptions.add(subscription);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  changeShowFilterOptions() {
    this.showFilterOptions = !this.showFilterOptions;
  }

  setReferenceInstance(refInstance: Instance | undefined) {
    this._referenceInstance = refInstance;
    if (refInstance === undefined) {
      this.showReferenceColumn = false;
      this.displayedColumns = ['name', 'value'];
    }
    else {
      this.showReferenceColumn = true;
      this.displayedColumns = ['name', 'value', 'referenceValue'];
      if (this._instance?.dbId === refInstance.dbId) {
        this.referenceColumnTitle = 'Database Value'
      }
      else {
        this.referenceColumnTitle = this._referenceInstance?.displayName!;
        this.valueColumnTitle = this._instance?.displayName!;
      }
    }
    this.updateTableContent();
  }

  changeShowHeaderActions() {
    this.showHeaderActions = !this.showHeaderActions;
  }

  doFilter(category: AttributeCategory) {
    let checked = this.categories.get(category);
    this.categories.set(category, !checked);
    this.updateTableContent();
  }

  sort() {
    this.sortAttDefined = false;
    this.sortAttNames = !this.sortAttNames;
    this.updateTableContent();
  }

  sortByDefined() {
    this.sortAttDefined = !this.sortAttDefined;
    this.updateTableContent();
  }

  onNoInstanceAttributeEdit(data: AttributeValue) {
    // this.attributeEditService.onNoInstanceAttributeEdit(data, this._instance!);
    if (this._instance!.source) // Need to push the change to the source instance first
      this.attributeEditService.onNoInstanceAttributeEdit(data, data.value, this._instance!.source, false);
    this.attributeEditService.onNoInstanceAttributeEdit(data, data.value, this._instance!, false);
    this.finishEdit(data.attribute.name, undefined);
  }

  deleteAttributeValue(attributeValue: AttributeValue) {
    if (this._instance!.source)
      this.attributeEditService.deleteAttributeValue(this._instance!.source, attributeValue);
    this.attributeEditService.deleteAttributeValue(this._instance, attributeValue);
    this.finishEdit(attributeValue.attribute.name, undefined);
  }

  onInstanceAttributeEdit(attributeValue: AttributeValue) {
    console.debug('onEdit: ', attributeValue);
    switch (attributeValue.editAction) {
      case EDIT_ACTION.DELETE:
        this.deleteInstanceAttribute(attributeValue);
        break;
      case EDIT_ACTION.ADD_NEW:
        this.addNewInstanceAttribute(attributeValue, false);
        break;
      case EDIT_ACTION.ADD_VIA_SELECT:
        this.addInstanceViaSelect(attributeValue, false);
        break;
      case EDIT_ACTION.REPLACE_NEW:
        this.addNewInstanceAttribute(attributeValue, true);
        break;
      case EDIT_ACTION.REPLACE_VIA_SELECT:
        this.addInstanceViaSelect(attributeValue, true);
        break;
      case EDIT_ACTION.BOOKMARK:
        this.addBookmarkedInstance(attributeValue);
        break;
      case EDIT_ACTION.EDIT_STOICHIOMETRY:
        this.editStoichiometry(attributeValue);
        break;
      default:
        console.error("The action doesn't know: ", attributeValue.editAction);
    }
  }

  private addNewInstanceAttribute(attributeValue: AttributeValue, replace: boolean
  ): void {
    const matDialogRef = this.dialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
      // console.debug(`New value for ${JSON.stringify(attributeValue)}: ${JSON.stringify(result)}`)
      // Add the new value
      if (!result || !result.instance) return; // Do nothing
      const created = result.instance;
      // Replacing a collapsed stoichiometry group swaps out every old copy for the newly created
      // instance in the old group's position, rather than replacing a single copy.
      if (replace && this.isStoichiometryAttribute(attributeValue.attribute)) {
        if (this._instance!.source)
          this.attributeEditService.replaceStoichiometryGroup(attributeValue, this._instance!.source, [created]);
        this.attributeEditService.replaceStoichiometryGroup(attributeValue, this._instance!, [created]);
        this.finishEdit(attributeValue.attribute.name, attributeValue.value);
        this.cdr.detectChanges();
        return;
      }
      // Use cached shell instance, honoring the replace/insert behavior.
      const insertAtIndex = !replace;
      if (this._instance!.source)
        this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(created), this._instance!.source, replace, true, insertAtIndex);
      this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(created), this._instance!, replace, true, insertAtIndex);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      this.cdr.detectChanges();
    });
  }

  private deleteInstanceAttribute(attributeValue: AttributeValue) {
    // A stoichiometry row is collapsed to "N × instance", so deleting it removes every copy of
    // that instance (use Edit Stoichiometry to change the count instead).
    if (this.isStoichiometryAttribute(attributeValue.attribute)) {
      if (this._instance?.source)
        this.attributeEditService.deleteAllInstanceOccurrences(attributeValue, this._instance.source);
      this.attributeEditService.deleteAllInstanceOccurrences(attributeValue, this._instance!);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      return;
    }
    // If there is a source instance, map the index based on dbId
    if (this._instance?.source) {
      const sourceAttributeValue = this.mapppingIndexInSourceInstance(attributeValue);
      this.attributeEditService.deleteInstanceAttribute(sourceAttributeValue, this._instance.source);
    }
    this.attributeEditService.deleteInstanceAttribute(attributeValue, this._instance!);
    this.finishEdit(attributeValue.attribute.name, attributeValue.value);
  }

  /**
   * Map the index of the attribute value in the source instance.
   * Handles single values, arrays, and cases where there is no value.
   * @param attributeValue 
   * @returns 
   */
  private mapppingIndexInSourceInstance(attributeValue: AttributeValue): AttributeValue {
    // If there is no value, just return the attributeValue as is
    if (!attributeValue || attributeValue.value === undefined) {
      return attributeValue;
    }

    const sourceValues = this._instance!.source!.attributes.get(attributeValue.attribute.name);

    // If sourceValues is undefined, just return the attributeValue as is
    // If the attribute is single-valued, nothing is needed to do.
    if (!sourceValues || attributeValue.attribute.cardinality === '1') {
      return attributeValue;
    }

    // Handle array value
    // Find the index of the first matching value in sourceValues
    // Here we just check the dbId. Array.isArray() should not be necessary here.
    const srcIndex = sourceValues.findIndex((srcVal: any) => srcVal?.dbId === attributeValue.value.dbId);
    // Regardless we will return a clone of the original one even though we cannot find
    // a match. 
    return { ...attributeValue, index: srcIndex };
  }

  private addInstanceViaSelect(attributeValue: AttributeValue, replace: boolean) {
    const matDialogRef =
      this.selectInstanceDialogService.openDialog(attributeValue);
    matDialogRef.afterClosed().subscribe((result) => {
      if (result === undefined || result.length === 0) return; // Do nothing
      // Replacing a collapsed stoichiometry group swaps out every old copy for the selected
      // instance(s) in the old group's position, rather than replacing a single copy.
      if (replace && this.isStoichiometryAttribute(attributeValue.attribute)) {
        if (this._instance!.source)
          this.attributeEditService.replaceStoichiometryGroup(attributeValue, this._instance!.source, result);
        this.attributeEditService.replaceStoichiometryGroup(attributeValue, this._instance!, result);
        this.finishEdit(attributeValue.attribute.name, attributeValue.value);
        this.cdr.detectChanges();
        return;
      }
      if (this._instance!.source)
        this.attributeEditService.addInstanceViaSelect(attributeValue, result, this._instance!.source, replace, true, !replace);
      this.attributeEditService.addInstanceViaSelect(attributeValue, result, this._instance!, replace, true, !replace);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      this.cdr.detectChanges();
    });
  }

  /**
   * Stoichiometry relationship types (input, output, hasComponent, repeatedUnit) may hold the
   * same instance multiple times. Their values are rendered as one collapsed "N ×" row per
   * unique instance rather than one row per copy.
   */
  isStoichiometryAttribute(attribute: SchemaAttribute | undefined): boolean {
    return attribute?.type === AttributeDataType.INSTANCE &&
      attribute?.cardinality !== '1' &&
      STOICHIOMETRY_RELATIONSHIP_TYPES.includes(attribute?.name ?? '');
  }

  /**
   * Collapse the repeated instance values of a stoichiometry attribute into one group per unique
   * instance. `index` is the position of the first copy in the underlying array (used to anchor
   * add/insert actions); `count` is how many copies exist; `items` are the actual copies, kept so
   * a drag reorder can rebuild the flat array exactly.
   */
  getStoichiometryGroups(rawValue: any): { value: any; count: number; index: number; items: any[] }[] {
    const list = Array.isArray(rawValue) ? rawValue : (rawValue === undefined ? [] : [rawValue]);
    const groups: { value: any; count: number; index: number; items: any[] }[] = [];
    list.forEach((v: any, i: number) => {
      const existing = groups.find(g => g.value?.dbId === v?.dbId);
      if (existing) {
        existing.count++;
        existing.items.push(v);
      } else {
        groups.push({ value: v, count: 1, index: i, items: [v] });
      }
    });
    return groups;
  }

  trackByGroupDbId(_index: number, group: { value: any }): any {
    return group.value?.dbId ?? _index;
  }

  /**
   * Reorder collapsed stoichiometry groups by drag/drop and rebuild the underlying array so all
   * copies of a moved instance stay together.
   */
  dropStoichiometry(event: CdkDragDrop<any[]>, element: AttributeValue) {
    const groups = this.getStoichiometryGroups(element.value);
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(groups, event.previousIndex, event.currentIndex);
    const rebuilt = groups.flatMap(g => g.items);
    this._instance!.attributes.set(element.attribute.name, rebuilt);
    this.finishEdit(element.attribute.name, rebuilt);
  }

  private editStoichiometry(attributeValue: AttributeValue) {
    const currentCount = this.countInstanceOccurrences(attributeValue);
    if (currentCount === 0) return;
    const dialogRef = this.dialog.open(StoichiometryDialogComponent, {
      width: '360px',
      data: {
        displayName: `${attributeValue.value?.displayName} [${attributeValue.value?.dbId}]`,
        currentCount,
      },
    });
    dialogRef.afterClosed().subscribe((newCount: number | undefined) => {
      if (newCount === undefined || newCount === currentCount) return;
      if (this._instance!.source)
        this.attributeEditService.setInstanceStoichiometry(attributeValue, this._instance!.source, newCount);
      this.attributeEditService.setInstanceStoichiometry(attributeValue, this._instance!, newCount);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      this.cdr.detectChanges();
    });
  }

  private countInstanceOccurrences(attributeValue: AttributeValue): number {
    let value = this._instance?.attributes?.get(attributeValue.attribute.name);
    if (value === undefined) return 0;
    if (!Array.isArray(value)) value = [value];
    const targetDbId = attributeValue.value?.dbId;
    return value.filter((v: any) => v?.dbId === targetDbId).length;
  }

  // Note: the value parameter is not used here, but kept for future extension
  finishEdit(attName: string, value: any, removeModifiedAttribute: boolean = false) {
    // Need to get the displayName before postEdit because postEdit may change the display name and we want to compare with the original one to decide whether to remove the modified attribute or not
    this.attributeEditService.removeDisplayNameModifiedAttribute(this._instance);
    this.attributeEditService.removeDisplayNameModifiedAttribute(this._instance?.source);
    // Need to call this before registerUpdatedInstance
    // in case the instance is used somewhere via the ngrx state management system
    if (!removeModifiedAttribute) {
      this.attributeEditService.addModifiedAttribute(this._instance, attName);
      this.attributeEditService.addModifiedAttribute(this._instance!.source, attName);
    } else {
      this.removeModifiedAttribute(attName);
    }
    this.inEditing = true;
    //Only add attribute name if value was added
    this.postEdit(attName);
    //TODO: Add a new value may reset the scroll position. This needs to be changed!
    this.updateTableContent();
    // Register the updated instances
    this.registerUpdatedInstance(attName);
    // Fire an event for other components to update their display (e.g. display name)
    // Usually this should be fired without issue
    this.editedInstance.emit(this._instance);
    if (this._instance?.source) {
      this.editedInstance.emit(this._instance.source);
    }
    this.inEditing = false;
  }

  addBookmarkedInstance(attributeValue: AttributeValue) {
    let result = attributeValue.value; //Only one value emitted at once

    // A bookmark is only ever refreshed lazily (see BookmarkListComponent), so it can go
    // stale if the underlying instance was deleted, renamed, or reclassified - by this user in
    // another tab, or by someone else - since it was bookmarked. Confirm it still exists and
    // refresh its class/displayName before wiring it into an attribute, rather than trusting
    // the bookmark shell as-is. Use fetchBookmarkShell() rather than fetchInstance(), which
    // would return a cached copy without a network round-trip and so could miss a change this
    // tab doesn't know about yet. A transient failure (network blip, session expiry) resolves
    // to the bookmark's current shell unchanged, so it isn't mistaken for the instance being
    // gone or having changed.
    this.dataService.fetchBookmarkShell(result.dbId).pipe(
      catchError(() => of(result))
    ).subscribe(fresh => {
      if (!fresh) {
        this.store.dispatch(BookmarkActions.remove_bookmark(this.instUtil.makeShell(result)));
        window.alert(`"${result.displayName ?? result.dbId}" no longer exists in the database and has been removed from your bookmarks.`);
        return;
      }
      if (fresh.schemaClassName !== result.schemaClassName || fresh.displayName !== result.displayName) {
        this.instUtil.refreshShellInstance(fresh);
        this.store.dispatch(BookmarkActions.add_bookmark(fresh));
      }

      if (this._instance!.source)
        this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(fresh), this._instance!.source, false, true, true);
      this.attributeEditService.addValueToAttribute(attributeValue, this.instUtil.getShellInstance(fresh), this._instance!, false, true, true);
      this.finishEdit(attributeValue.attribute.name, attributeValue.value);
      this.cdr.detectChanges();
    });
  }

  donePostEdit(
    instance: Instance,
    editedAttributeName: string | undefined
  ): boolean {
    // Async post-edit operations (e.g. the auto-fillers) may update the display name only
    // after their HTTP response resolves, which is after finishEdit() already registered the
    // updated instance in the store with the previous (stale) display name. Re-register here so
    // the NgRx store shell (used by the updated/local list views) reflects the new display name.
    if (instance)
      this.instUtil.registerUpdatedInstance(editedAttributeName ?? '', instance);
    this.updateTableContent();
    return true;
  }

  donePreProcess(instance: Instance): boolean {
    this.updateTableContent();
    return true;
  }

  updateTableContent(): void {
    // Without a reference column the filter means "attributes I edited", which InstanceDataSource
    // answers from the instance's own edit tracking (modifiedAttributes). Whenever a reference
    // instance is shown the filter means "attributes whose values differ", and that has to be
    // answered by diffing value against referenceValue: comparing two different instances has no
    // edit tracking to filter on, so filtering by modifiedAttributes there emptied the table.
    // InstanceComparisonDataSource does the diff, and unions both schema classes' attributes so
    // attributes defined by only one of the two classes still show up.
    if (this._referenceInstance === undefined) {
      this.instanceDataSource = new InstanceDataSource(
        this._instance,
        this.categories,
        this.sortAttNames,
        this.sortAttDefined,
        this.filterEdited,
        this._referenceInstance
      );
      this.instanceDataSource.connect();
    }
    else {
      this.instanceDataSource = new InstanceComparisonDataSource(
        this._instance,
        this.categories,
        this.sortAttNames,
        this.sortAttDefined,
        this.filterEdited,
        this._referenceInstance
      );
      this.instanceDataSource.connect();
    }
  }

  private registerUpdatedInstance(attName: string): void {
    if (this.preventEvent)
      return;
    // Make sure the instance we just edited IS the one held in the DataService cache
    // (id2instance). When a pathway is navigated to within the Event view, the object
    // shown here can diverge from the cached object; the edit then lands only on this
    // displayed object while the cache stays stale. That stale cache is what the
    // reload re-binds to (value disappears on screen) and what persistence reads
    // (value never saved). Re-registering keeps display, event tree, and persistence
    // in sync. Register before dispatching so the synchronous last_updated_instance
    // effect (which re-fetches from the cache) sees the edited instance.
    if (this._instance) {
      this.dataService.registerInstance(this._instance.source ?? this._instance);
    }
    this.instUtil.registerUpdatedInstance(attName, this._instance!);
  }

  private removeModifiedAttribute(attributeName: string) {
    if (
      this._instance === undefined ||
      this._instance.modifiedAttributes === undefined
    )
      return;
    // If nothing is in the modifiedAttributes, remove this instance from the changed list
    if (this._instance.source)
      this.attributeEditService.removeModifiedAttribute(this._instance.source, attributeName);
    this.attributeEditService.removeModifiedAttribute(this._instance, attributeName);
    if (this._instance.modifiedAttributes.length === 0) {
      this.store.dispatch(
        // Always make a shell when dispatch to avoid lock the instance by ngrx store!!!
        UpdateInstanceActions.remove_updated_instance(this.instUtil.makeShell(this._instance))
      );
    }
  }

  /**
   * Provide a hook to do something (e.g. update display name, perform QA etc) after
   * any editing.
   * @param attName
   */
  postEdit(attName: string) {
    if (this._instance)
      this.postEditService.postEdit(this._instance, attName, this);
    if (this._instance?.source)
      this.postEditService.postEdit(this._instance.source, attName, this);
  }

  drop(event: CdkDragDrop<string[]>, value: SchemaAttribute) {
    const arrayCopy = [...(event.container.data as any[])];
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    console.debug('value', this._instance);

    // If there is a source instance, map the indices to the source attribute array
    if (this._instance?.source) {
      const sourceAttrArray = this._instance.source.attributes.get(value.name);
      if (Array.isArray(sourceAttrArray)) {
        // Map previousIndex and currentIndex to source indices
        const prevValue = this.mapppingIndexInSourceInstance({
          attribute: value,
          value: arrayCopy[event.previousIndex],
        });
        const currValue: AttributeValue = this.mapppingIndexInSourceInstance({
          attribute: value,
          value: arrayCopy[event.currentIndex],
        });

        if (event.previousContainer === event.container) {
          // Move within the same array in source
          if (prevValue.index !== -1 && currValue.index !== -1) {
            moveItemInArray(sourceAttrArray, prevValue.index!, currValue.index!);
          }
        } else {
          // Transfer between arrays in source
          if (prevValue.index !== -1 && currValue.index !== -1) {
            transferArrayItem(
              event.previousContainer.data,
              event.container.data,
              event.previousIndex,
              event.currentIndex
            );
            transferArrayItem(
              sourceAttrArray,
              sourceAttrArray,
              prevValue.index!,
              currValue.index!
            );
          }
        }
      } else {
        // If not array, just set as is
        this._instance.source.attributes.set(value.name, event.container.data);
      }
    }

    this.finishEdit(value.name, event.container.data);
  }

  stopDragging() {
    console.debug('stopDragging because of drag exit');
    this.dragDropStatus = {
      dragging: false,
      dropping: false,
      draggedInstance: undefined,
    };
    this.clearDragHover();
  }

  /**
   * A value of the slot under the cursor reports that the drag entered or left it. Tracked per
   * attribute so that the highlight spans every value of the slot, which is what the drop actually
   * targets.
   */
  onDragHover(status: DragHoverStatus) {
    if (status.hovered) {
      this.dragHoverAttribute = status.attribute.name;
      this.dragHoverDroppable = status.droppable;
    }
    // Moving between two values of the same slot fires leave on the old one before enter on the
    // new one, so only clear when the slot being left is still the one recorded.
    else if (this.dragHoverAttribute === status.attribute.name) {
      this.clearDragHover();
    }
  }

  /**
   * Highlight to apply to an attribute's value cell while a bookmark is being dragged over it.
   */
  dragHoverClass(attribute: SchemaAttribute): string | undefined {
    if (!this.dragDropStatus.dragging || this.dragHoverAttribute !== attribute.name)
      return undefined;
    return this.dragHoverDroppable ? 'droppable' : 'notDroppable';
  }

  private clearDragHover() {
    this.dragHoverAttribute = undefined;
    this.dragHoverDroppable = false;
  }

  protected readonly AttributeCategory = AttributeCategory;

  bookmarkDrop($event: CdkDragDrop<Instance | undefined>) {
    console.debug('bookmarkDrop: ', $event);
    this.dragDropStatus = {
      dragging: false,
      dropping: true,
      draggedInstance: $event.item.data,
    };
    this.clearDragHover();
  }

  dragEntering($event: CdkDragEnter<Instance | undefined>) {
    console.debug('dragEntering: ', $event.item.data);
    this.dragDropStatus = {
      dragging: true,
      dropping: false,
      draggedInstance: $event.item.data,
    };
  }

  // values removed or edited passively should be compared to the instance value 
  // to display the passive index of a multivariate attribute 
  getValueTypeForComparison(instanceVal: any, refVal: any) {
    // One singular instance
    if (instanceVal.dbId) {
      if (refVal === undefined) return true;
      else {
        return instanceVal.dbId !== refVal.dbId;
      }
    }
    // An array of instances
    else {
      if (refVal === undefined || instanceVal.length !== refVal.length)
        return true;
      else if (instanceVal[0].dbId) {
        for (let i = 0; i < instanceVal.length; i++) {
          if (instanceVal[i].dbId !== refVal[i].dbId) {
            return true;
          }
        }
      }
      // An array of non-instances
      else {
        for (let i = 0; i < instanceVal.length; i++) {
          if (instanceVal[i] !== refVal[i]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  resetEdit(attributeValue: AttributeValue) {
    if (!this._instance || !this._referenceInstance) return; // Do nothing if instance or reference instance is not defined
    if (this._instance.source) {
      this.attributeEditService.resetAttributeValue(this._instance.source, attributeValue);
    }
    // Need a small utility to check that instance has not been deleted 
    let filteredValues = this.filterAttributeValueForDeletion(attributeValue);
    let attributeValueClone: AttributeValue = {
      attribute: attributeValue.attribute,
      referenceValue: filteredValues,
      value: attributeValue.value
    };
    this.attributeEditService.resetAttributeValue(this._instance, attributeValueClone);
    this.finishEdit(attributeValue.attribute.name,
      attributeValue.value,
      this._instance.dbId === this._referenceInstance.dbId);
  }

  private filterAttributeValueForDeletion(attributeValue: AttributeValue): any {
    if (!attributeValue || !attributeValue.referenceValue) return undefined;
    // If value is an array, filter out deleted dbIds
    if (Array.isArray(attributeValue.referenceValue)) {
      return attributeValue.referenceValue
        .filter(
          (val: any) => !(val && val.dbId && this.deletedDBIds.includes(val.dbId))
        );
    }
    // If value is a single instance, check dbId
    if (attributeValue.referenceValue.dbId) {
      return this.deletedDBIds.includes(attributeValue.referenceValue.dbId) ? undefined : attributeValue.referenceValue;
    }
    // For primitive values, just return as is
    return attributeValue.referenceValue;
  }

  filterEditedValues() {
    this.filterEdited = !this.filterEdited;
    this.updateTableContent();
  }

  isRequired(element: AttributeValue): boolean {
    if (element.attribute.category === AttributeCategory.REQUIRED && element.value === undefined) {
      return true;
    }
    else {
      return false;
    }
  }

  isMandatory(element: AttributeValue): boolean {
    if (element.attribute.category === AttributeCategory.MANDATORY && element.value === undefined) {
      return true;
    }
    else {
      return false;
    }
  }

  isInstanceDeleted(): boolean {
    if (this.deletedDBIds.length === 0) return false;
    if (this.deletedDBIds.includes(this._instance!.dbId)) return true;
    return false;
  }

  isActiveEdited(attName: string): boolean {
    // For comparison mode (instance vs reference instance)
    if (this._referenceInstance && this._instance?.dbId !== this._referenceInstance?.dbId) {
      let instanceVal = this._instance?.attributes.get(attName);
      let refVal = this._referenceInstance?.attributes.get(attName);
      if ((instanceVal && instanceVal.dbId) || instanceVal instanceof Array) {
        return this.getValueTypeForComparison(instanceVal, refVal);
      }
      return (instanceVal !== refVal);
    }
    // For regular edit mode (check if attribute was modified by user)
    return this._instance?.modifiedAttributes?.includes(attName) || false;
  }

  activeAndPassiveEdit(attName: string): boolean {
    let hasActiveEdit = this.isActiveEdited(attName);
    let hasPassiveEdit = this.isPassiveEdited(attName);
    return hasActiveEdit && hasPassiveEdit;
  }

  isPassiveEdited(attName: string): boolean {
    return this._instance?.passiveModifiedAttributes?.includes(attName) || false;
  }

  getAttributeTooltip(attribute: SchemaAttribute): string {
    let tooltip = '';
    if (this.isRequired({ attribute } as AttributeValue)) {
      tooltip += attribute.name + ' is required. It is recommended to have a value.';
    }
    if (this.isMandatory({ attribute } as AttributeValue)) {
      tooltip += ' ' + attribute.name + ' is mandatory. It should not be empty.';
    }
    if (this.isActiveEdited(attribute.name) && this.isPassiveEdited(attribute.name)) {
      tooltip += ' ' + attribute.name + ' has both active and passive edits.';
    }
    if (this.isActiveEdited(attribute.name)) {
      tooltip += ' ' + attribute.name + ' has been actively edited.';
    }
    if (this.isPassiveEdited(attribute.name)) {
      tooltip += ' ' + attribute.name + ' has been passively edited.';
    }
    return tooltip;
  }
}
