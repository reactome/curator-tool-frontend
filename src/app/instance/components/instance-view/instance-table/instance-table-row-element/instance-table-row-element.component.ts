import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
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
import {CdkDrag, CdkDragDrop, CdkDragEnter, CdkDropList} from "@angular/cdk/drag-drop";
import {Instance} from "../../../../../core/models/reactome-instance.model";
import {DataService} from "../../../../../core/services/data.service";
import {DragDropService} from "../../../../../instance-bookmark/drag-drop.service";

/**
 * Used to display a single value of an Instance object.
 */
@Component({
  selector: 'app-instance-table-row-element',
  templateUrl: './instance-table-row-element.component.html',
  styleUrls: ['./instance-table-row-element.component.scss']
})
export class InstanceTableRowElementComponent implements OnInit, AfterViewInit, OnDestroy {
  // Value to be displayed here
  @Input() attribute: SchemaAttribute | undefined = undefined;
  @Input() value: any;
  @Input() index: number = 0; // The position for a value in multi-slot
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
  candidateClasses: string[] = [];

  // viewOnly as a service is drilled down too deep in the component hierarchy. Better not been here and disable
  // the editing using a simple flag!
  constructor(private store: Store, private _ngZone: NgZone, private dataService: DataService, public viewOnly: ViewOnlyService, public dragDropService: DragDropService,
              private elementRef: ElementRef<HTMLElement>) {
    if (viewOnly.enabled)
      this.control.disable();
  }

  ngAfterViewInit(): void {
    if (this.attribute?.type === AttributeDataType.INSTANCE && this.attribute?.category !== AttributeCategory.NOMANUALEDIT) {
      this.dragDropService.register(this.attribute!.name)
    }
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

  drop(event: CdkDragDrop<InstanceTableRowElementComponent, CdkDrag<any>>) {
    console.log("event", event);
    if(event.isPointerOverContainer){
      this.value = event.item.data;
      console.log("value", this.value)
      this.onEditAction(EDIT_ACTION.BOOKMARK)
    }
    else{
      return
    }

  }

  canDrop(drag: CdkDrag<Instance>, drop: CdkDropList<InstanceTableRowElementComponent>) {
    // console.log('Instance that is dragged: ', drag.data);
    // console.log('Attribute to be dragged into: ', drop.data.attribute);
    if (drop.data.attribute) {
      let candidateClasses = drop.data.dataService.setCandidateClasses(drop.data.attribute);
      //console.log("schema class", drag.data.schemaClassName)
      // this.dragDropService.canDrop = canDrop;
      return candidateClasses.includes(drag.data.schemaClassName);
    }
    return false;
  }

  onContainerExit(event: MouseEvent){
    let element = document.getElementById('cdkDragPreviewClass')
     console.log("onExit", element)
  }

  ngOnDestroy(): void {
    this.dragDropService.unregister(this.attribute!.name);
  }

  protected readonly clearTimeout = clearTimeout;

  dragEntering($event: CdkDragEnter<InstanceTableRowElementComponent>) {
    this.dragDropService.canDrop = true
  }

  mouseLeave() {
    this.dragDropService.canDrop = false
  }
}


