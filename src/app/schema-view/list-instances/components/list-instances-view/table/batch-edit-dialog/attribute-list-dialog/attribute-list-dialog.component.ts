import { Component, EventEmitter, Inject, Output, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectionList } from '@angular/material/list';
import { AttributeDataType } from 'src/app/core/models/reactome-schema.model';
import { AttributeValue } from 'src/app/instance/components/instance-view/instance-table/instance-table.model';

@Component({
  selector: 'app-attribute-list-dialog',
  templateUrl: './attribute-list-dialog.component.html',
  styleUrls: ['./attribute-list-dialog.component.scss']
})
export class AttributeListDialogComponent {
  @ViewChild('attributes') attributesList!: MatSelectionList;
  // So that we can use it in the template
  DATA_TYPES = AttributeDataType;
  attributeSelected: AttributeValue[] = [];
  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public data: any[],
      public dialogRef: MatDialogRef<AttributeListDialogComponent>,
  ) {}

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
}