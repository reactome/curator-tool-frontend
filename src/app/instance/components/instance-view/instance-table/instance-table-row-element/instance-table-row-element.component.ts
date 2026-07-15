import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { CdkContextMenuTrigger, CdkMenuTrigger } from "@angular/cdk/menu";
import {
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { FormControl, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Store } from "@ngrx/store";
import { Observable, take } from "rxjs";
import { AttributeCategory, AttributeDataType, SchemaAttribute } from 'src/app/core/models/reactome-schema.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { AttributeValue, EDIT_ACTION, Instance } from "../../../../../core/models/reactome-instance.model";
import { DataService } from "../../../../../core/services/data.service";
import { DragDropService } from "../../../../../schema-view/instance-bookmark/drag-drop.service";
import { DragDropStatus } from '../instance-table.model';
import { MatDialog } from "@angular/material/dialog";
import { TextEditorDialogComponent } from "./text-editor-dialog/text-editor-dialog.component";
import { InfoDialogComponent } from "src/app/shared/components/info-dialog/info-dialog.component";
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
  @Input() index: number = -1; // The position for a value in multi-slot
  @Input() blockRoute: boolean = false;
  // Whether the instance being edited has a populated stableIdentifier. Used to decide whether the
  // species-edit warning (about the stId/stableIdentifier changing) is relevant.
  @Input() hasStableIdentifier: boolean = false;
  
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
  showEditorButton: boolean = false;
  // Controls visibility of the inline edit-action button for populated instance values.
  showActions: boolean = false;
  // Tracks whether the edit menu is currently open so the trigger button is kept rendered
  // (and the menu kept open) even after the cursor leaves the row.
  menuOpen: boolean = false;
  // viewOnly as a service is drilled down too deep in the component hierarchy. Better not been here and disable
  // the editing using a simple flag!
  constructor(private store: Store,
    private _ngZone: NgZone,
    private dataService: DataService,
    private route: ActivatedRoute,
    public dragDropService: DragDropService,
    private instanceUtilities: InstanceUtilities,
    private dialog: MatDialog) {
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
    if (this.control.value === this.value) {
      return; // No change, do nothing
    }
    let attributeValue: AttributeValue = {
      attribute: this.attribute!,
      value: this.control.value, // Get the new value from control
      index: this.index
    }
    this.newValueEvent.emit(attributeValue);
    this.triggerResize();
  }

  private lastContextMenuPosition = { x: 0, y: 0 };
  private skipSpeciesWarning = false;
  // True while the species warning dialog is open. Keeps the trigger button mounted so its
  // CdkMenuTrigger instance stays valid for reopening (a destroyed trigger reopens at 0,0).
  private speciesWarningPending = false;

  onContextMenu(event: MouseEvent) {
    this.lastContextMenuPosition = { x: event.x, y: event.y };
  }

  onMenuOpened(trigger: CdkContextMenuTrigger | CdkMenuTrigger) {
    this.menuOpen = true;
    // Only warn about the stId/stableIdentifier changing when the instance actually has a
    // stableIdentifier to change.
    if (this.attribute?.name === 'species' && this.hasStableIdentifier) {
      if (this.skipSpeciesWarning) {
        this.skipSpeciesWarning = false;
        return;
      }
      // Opening the dialog closes the menu (its backdrop counts as an outside click). Flag the
      // warning as pending so onMenuClosed/mouseLeave keep the trigger button mounted, otherwise
      // Angular destroys its CdkMenuTrigger and reopening `trigger` anchors the overlay at (0,0).
      this.speciesWarningPending = true;
      this.showActions = true;
      const dialogRef = this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Warning',
          message: 'Warning: editing the species may result in a change to the stId and the stableIdentifier',
        }
      });
      dialogRef.afterClosed().subscribe(() => {
        this.speciesWarningPending = false;
        this.skipSpeciesWarning = true;
        // If the dialog already closed the menu, reopen it now that the warning is acknowledged.
        // CdkContextMenuTrigger opens at a coordinate; CdkMenuTrigger (button) opens relative to itself.
        if (!trigger.isOpen()) {
          if (trigger instanceof CdkContextMenuTrigger)
            trigger.open(this.lastContextMenuPosition);
          else
            trigger.open();
        }
      });
    }
  }

  onMenuClosed() {
    this.menuOpen = false;
    // If the cursor already left the row while the menu was open, hide the action button now.
    // Keep it while a species warning is pending so the trigger can reopen the menu afterwards.
    if (!this.isMouseIn && !this.speciesWarningPending)
      this.showActions = false;
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
    // this._ngZone.onStable.pipe(take(1)).subscribe(() => {
    //   if (this.autosize) // Somehow this.autosize! cannot work!
    //     this.autosize.resizeToFitContent(true)
    // });
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
    // Keep the action button (and therefore the open menu) visible while the menu is open.
    // It will be hidden when the menu closes (see onMenuClosed). Also keep it during a species
    // warning so the trigger stays mounted for reopening.
    if (!this.menuOpen && !this.speciesWarningPending)
      this.showActions = false;
    if (this.isSummationText())
      this.showEditorButton = false;
  }

  mouseEnter() {
    this.isMouseIn = true;
    this.showActions = true;
    if (this.isDroppable) {
      this.color = true;
    }
    if (this.isSummationText())
      this.showEditorButton = true;
  }

  private dropInstance(draggedInstance: Instance | undefined) {
    if (draggedInstance === undefined || !this.isMouseIn || !this.canDrop(draggedInstance))
      return;
    console.log("dropInstance: ", this.attribute, draggedInstance);
    let attributeValue: AttributeValue = {
      attribute: this.attribute!,
      value: this.instanceUtilities.makeShell(draggedInstance),
      index: this.index,
      editAction: EDIT_ACTION.BOOKMARK,
    }
    this.editAction.emit(attributeValue);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter') {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const textarea = event.target as HTMLTextAreaElement;
      const value = this.control.value ?? '';
      const start = textarea.selectionStart ?? value.length;
      const end = textarea.selectionEnd ?? value.length;
      const newValue = `${value.slice(0, start)}\n${value.slice(end)}`;
      this.control.setValue(newValue);
      setTimeout(() => {
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = start + 1;
      });
      this.triggerResize();
      return;
    }
    event.preventDefault();
    this.onChange(); // Enter commits the edit
  }

  preventNonIntegerInput(event: KeyboardEvent) {
    const allowedControlKeys = new Set([
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
    ]);
    if (allowedControlKeys.has(event.key) || event.ctrlKey || event.metaKey) {
      return;
    }

    const isDigit = /^\d$/.test(event.key);
    const input = event.target as HTMLInputElement;
    const isNegativeSign = event.key === '-' && input.selectionStart === 0 && !input.value.includes('-');

    if (!isDigit && !isNegativeSign) {
      event.preventDefault();
    }
  }

  /**
   * Handle pasting into an integer field (e.g. pubMedIdentifier). Accepts either a bare id or a
   * link whose id is at the end (e.g. https://pubmed.ncbi.nlm.nih.gov/12345678). Without this, a
   * pasted URL is left to the native number input, which keeps stray characters such as the "e"
   * in "pubmed" and produces values like "e12345678".
   */
  onIntegerPaste(event: ClipboardEvent) {
    const pasted = (event.clipboardData?.getData('text') ?? '').trim();
    if (!pasted || /^-?\d+$/.test(pasted)) {
      return; // Empty or already a plain integer: let the input handle it
    }
    const match = pasted.match(/(\d+)\/?$/); // Trailing digits, tolerating a trailing slash
    if (!match) {
      return;
    }
    event.preventDefault();
    this.control.setValue(Number(match[1]));
    this.onChange();
  }

  preventNonFloatInput(event: KeyboardEvent) {
    const allowedControlKeys = new Set([
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
    ]);
    if (allowedControlKeys.has(event.key) || event.ctrlKey || event.metaKey) {
      return;
    }

    const isDigit = /^\d$/.test(event.key);
    const input = event.target as HTMLInputElement;
    const isNegativeSign = event.key === '-' && input.selectionStart === 0 && !input.value.includes('-');
    const isDecimalPoint = event.key === '.' && !input.value.includes('.');

    if (!isDigit && !isNegativeSign && !isDecimalPoint) {
      event.preventDefault();
    }
  }

  onInstanceLinkClicked(instance: Instance) {
    this.instanceUtilities.setLastClickedDbId(instance.dbId);
  }

  getInstanceUrlRoot(instance: Instance) {
    if (this.blockRoute) return undefined;
    // Always use schema_view for the links of instances in the table
    const url = "/schema_view/instance/" + instance.dbId;
    let currentPathRoot = this.route.pathFromRoot.map(route => route.snapshot.url)
      .reduce((acc, val) => acc.concat(val), [])
      .map(urlSegment => urlSegment.path);
    return url;
    // return "/" + currentPathRoot[0] + "/instance/" + instance.dbId.toString();
  }

  isSummationText(): boolean {
    if (this.attribute?.name === "text" && this.control.enabled) { return true; }
    else return false;
  }

  openTextEditorDialog(): void {
    const dialogRef = this.dialog.open(TextEditorDialogComponent, {
      width: '700px',
      height: '500px',
      data: { text: this.control.value }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        this.control.setValue(result);
        this.onChange();
      }
    });
  }

}
