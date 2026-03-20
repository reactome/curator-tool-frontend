import { Component, EventEmitter, Inject, Output, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogContent } from '@angular/material/dialog';
import { MatSelectionList } from '@angular/material/list';
import { Observable, of } from 'rxjs';
import { AttributeValue, Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeDataType } from 'src/app/core/models/reactome-schema.model';

@Component({
  selector: 'app-attribute-list-dialog',
  templateUrl: './attribute-list-dialog.component.html',
  styleUrls: ['./attribute-list-dialog.component.scss'],
})
export class AttributeListDialogComponent {
  handleListTableAction($event: { instance: Instance; action: string; }) {
    throw new Error('Method not implemented.');
  }

  onRowClick($event: Instance) {
    throw new Error('Method not implemented.');
  }
  handleAction($event: { instance: Instance; action: string; }) {
    throw new Error('Method not implemented.');
  }
  @ViewChild('attributes') attributesList!: MatSelectionList;
  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;
  attributeSelected: AttributeValue[] = [];
  displayedColumns: string[] = ['displayName', 'actionButtons'];
  _selectedAttributes: Observable<any[]> = new Observable<any[]>();
  selectedAttributes: any[] = []
  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public data: { selectedAttribute: string, values: any[] },
    public dialogRef: MatDialogRef<AttributeListDialogComponent>,
  ) { }

  onAttributeSelected(attributeValue: AttributeValue) {
    console.debug('onAttributeSelected: ', attributeValue);
    // This is used to select the attribute in the list
    this.attributeSelected.push(attributeValue);
  }

  onOK() {
    this.dialogRef.close(this.attributeSelected);
  }

  onCancel() {
    this.dialogRef.close();
  }

  addCheckBox(element: any) {
    this._selectedAttributes.subscribe(selected => {
      if (selected.includes(element)) {
        this.attributeSelected = this.attributeSelected.filter(attr => attr !== element)
        this._selectedAttributes = of(this.attributeSelected);
      } else {
        this.attributeSelected.push(element);
        this._selectedAttributes = of(this.attributeSelected);
      }
    }).unsubscribe();
  }

}