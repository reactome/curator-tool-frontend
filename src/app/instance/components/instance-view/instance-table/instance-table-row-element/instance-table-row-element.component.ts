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
import {Store} from "@ngrx/store";
import {AttributeCategory, AttributeDataType, SchemaAttribute} from 'src/app/core/models/reactome-schema.model';
import {AttributeValue, EDIT_ACTION} from '../instance-table.model';
import {CdkTextareaAutosize} from "@angular/cdk/text-field";
import {take} from "rxjs";
import {FormControl, Validators} from "@angular/forms";
import {ViewOnlyService} from "../../../../../core/services/view-only.service";
import {DataService} from "../../../../../core/services/data.service";
import {DragDropService} from "../../../../../instance-bookmark/drag-drop.service";
import {Instance} from "../../../../../core/models/reactome-instance.model";

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
  @Input() set draggedInstance(draggedInstance: any) {
    if (draggedInstance !== undefined) {
      this.dragInstance = draggedInstance;
    }
  };
  @Input() set dragging(isDragging: boolean) {
    this.isDragging = isDragging;
  }

  @Input() set dropping(isDropping: boolean) {
    this.isDropping = isDropping
    if (this.isDropping) {
      this.checkDrop()
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
  mouseIn: boolean = false;
  dragInstance?: Instance;
  isDragging: boolean = false;
  isDropping: boolean = false;
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

  canDrop() {
    if (this.attribute) {
      let candidateClasses = this.dataService.setCandidateClasses(this.attribute);
      console.log(candidateClasses.includes(this.dragInstance))
      if (candidateClasses.includes(this.dragInstance?.schemaClassName)) {
        this.color = true;
        return true;
      }
    }
    return false;
  }

  mouseLeave() {
    this.mouseIn = false
  }

  mouseEnter() {
    this.mouseIn = true;
    this.canDrop();
  }

  private checkDrop() {
    console.log("mouseIn", this.isDragging, this.canDrop())
    if (this.canDrop() && this.mouseIn) {
      let attributeValue: AttributeValue = {
        attribute: this.attribute!,
        value: this.dragInstance,
        index: this.index,
        editAction: EDIT_ACTION.BOOKMARK,
      }
      console.log(attributeValue)
      this.editAction.emit(attributeValue);
    }
  }
}
