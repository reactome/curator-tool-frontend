import { Component, EventEmitter, Inject, Output, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogContent } from '@angular/material/dialog';
import { MatSelectionList } from '@angular/material/list';
import { Observable, of } from 'rxjs';
import { AttributeValue, Instance } from 'src/app/core/models/reactome-instance.model';
import { ACTION_BUTTONS, AttributeDataType } from 'src/app/core/models/reactome-schema.model';
import { SelectedInstancesList } from 'src/app/core/models/reactome-instance.model';
import { ActionButton } from '../../instance-list-table/instance-list-table.component';

@Component({
  selector: 'app-attribute-list-dialog',
  templateUrl: './attribute-list-dialog.component.html',
  styleUrls: ['./attribute-list-dialog.component.scss'],
})
export class AttributeListDialogComponent {
  @ViewChild('attributes') attributesList!: MatSelectionList;
  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;
  displayedColumns: string[] = ['displayName', 'actionButtons'];
  _selectedAttributes: Observable<any[]> = new Observable<any[]>();
  selectedAttributes: any[] = []
  SelectedInstancesList = SelectedInstancesList;
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.LAUNCH];
  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public data: { selectedAttribute: string, values: any[] },
    public dialogRef: MatDialogRef<AttributeListDialogComponent>,
  ) { }

  onOK() {
    this.dialogRef.close(this.selectedAttributes);
  }

  onCancel() {
    this.dialogRef.close();
  }

  addCheckBox(element: any) {
    if (this.selectedAttributes.some(att => att === element)) {
      return;
    }

    this.selectedAttributes.push(element);
    this.selectedAttributes = [...this.selectedAttributes];
  }

  removeCheckBox(element: any) {
    this.selectedAttributes = this.selectedAttributes.filter(att => att !== element);
  }

  handleAction($event: { instance: Instance; action: string; }) {
    switch ($event.action) {
      case ACTION_BUTTONS.LAUNCH.name: {
        const dbId = $event.instance.dbId;
        window.open(`schema_view/instance/${dbId}`, '_blank');
        break;
      }

      case ACTION_BUTTONS.CHECK_BOX.name: {
        if (this.selectedAttributes.some(att => att === $event.instance)) {
          this.removeCheckBox($event.instance);
        } else {
          this.addCheckBox($event.instance);
        }
        break;  
      }
    }

  }

}