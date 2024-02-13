import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { Store } from "@ngrx/store";
import { AttributeCategory, AttributeDataType, SchemaAttribute } from 'src/app/core/models/reactome-schema.model';
import { AttributeValue, DragDropStatus, EDIT_ACTION } from '../instance-table.model';
import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { take } from "rxjs";
import { FormControl, Validators } from "@angular/forms";
import { ViewOnlyService } from "../../../../../core/services/view-only.service";
import { DataService } from "../../../../../core/services/data.service";
import { DragDropService } from "../../../../../instance-bookmark/drag-drop.service";
import { Instance } from "../../../../../core/models/reactome-instance.model";

/**
 * Used to display a single value of an Instance object.
 */
@Component({
  selector: 'app-instance-table-row-element',
  templateUrl: './instance-table-row-element.component.html',
  styleUrls: ['./instance-table-row-element.component.scss']
})
export class InstanceTableRowElementComponent implements OnInit {
  // Value to be displayed here
  @Input() attribute: SchemaAttribute | undefined = undefined;
  @Input() value: any;
  @Input() index: number = 0; // The position for a value in multi-slot

  // The following properties and attributes are used for DnD from bookmarks
  private isMouseIn: boolean = false;
  dragging: boolean = false;
  isDroppable: boolean = false;
  @Input() set dragDropStatus(dndStatus: DragDropStatus) {
    // console.debug('set dragDropStatus', dndStatus);
    this.dragging = dndStatus.dragging;
    if (dndStatus.dropping) {
      this.dropInstance(dndStatus.draggedInstance);
    }
    else {
      // Call onces to set the color
      this.color = this.canDrop(dndStatus.draggedInstance);
      this.isDroppable = this.color;
    }
  }

  // @Output() canDropEvent = new EventEmitter<string>();
  @Output() newValueEvent = new EventEmitter<AttributeValue>();
  // Edit action
  @Output() editAction = new EventEmitter<AttributeValue>();

  // To disable it manually
  @Input() set disable(disable: boolean) {
    if (disable)
      this.control.disable();
    else
      this.control.enable();
  }

  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;

  control = new FormControl();
  showField: boolean = true;
  color: boolean = false;

  // viewOnly as a service is drilled down too deep in the component hierarchy. Better not been here and disable
  // the editing using a simple flag!
  constructor(private store: Store, private _ngZone: NgZone, private dataService: DataService, public viewOnly: ViewOnlyService, public dragDropService: DragDropService,
    private elementRef: ElementRef<HTMLElement>) {
    if (viewOnly.enabled)
      this.control.disable();
  }

  @ViewChild('autosize') autosize: CdkTextareaAutosize | undefined;

  ngOnInit() {

    if (this.attribute?.category === AttributeCategory.NOMANUALEDIT) {
      this.control.disable();
    }

    this.control.setValue(this.value);

    if (this.attribute?.category && [AttributeCategory.REQUIRED, AttributeCategory.MANDATORY].includes(this.attribute?.category)) {
      this.control.addValidators([Validators.required])
    }
  }


  onChange() {
    let attributeValue: AttributeValue = {
      attribute: this.attribute!,
      value: this.control.value, // Get the new value from control
      index: this.index
    }
    console.debug("onChange: ", attributeValue);
    this.newValueEvent.emit(attributeValue);
    this.triggerResize();
  }

  onEditAction(action: EDIT_ACTION) {
    let attributeValue: AttributeValue = {
      attribute: this.attribute!,
      value: this.value,
      index: this.index,
      editAction: action,
    }
    console.debug("onEditAction: ", attributeValue);
    this.editAction.emit(attributeValue);
  }

  triggerResize() {
    // Wait for changes to be applied, then trigger textarea resize.
    this._ngZone.onStable.pipe(take(1)).subscribe(() => {
      if (this.autosize) // Somehow this.autosize! cannot work!
        this.autosize.resizeToFitContent(true)
    });
  }

  canDrop(draggedInstance: Instance | undefined) {
    if (draggedInstance === undefined) {
      return false;
    }
    if (this.attribute) {
      let candidateClasses = this.dataService.setCandidateClasses(this.attribute);
      if (candidateClasses.includes(draggedInstance.schemaClassName)) {
        return true;
      }
    }
    return false;
  }

  mouseLeave() {
    this.isMouseIn = false
    this.color = false;
  }

  mouseEnter() {
    this.isMouseIn = true;
    if (this.isDroppable) {
      this.color = true;
    }
  }

  private dropInstance(draggedInstance: Instance | undefined) {
    if (draggedInstance === undefined || !this.isMouseIn || !this.canDrop(draggedInstance))
      return;
    console.log("dropInstance: ", this.attribute, draggedInstance);
    let attributeValue: AttributeValue = {
      attribute: this.attribute!,
      value: draggedInstance,
      index: this.index,
      editAction: EDIT_ACTION.BOOKMARK,
    }
    this.editAction.emit(attributeValue);
  }
}
