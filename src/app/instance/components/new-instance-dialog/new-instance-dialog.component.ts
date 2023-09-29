import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';

/**
 * A dialog component that is used to create a new Instance object.
 *
 * <b>Note</b>: It is just too complexity to use rxjs store to manage new instance creation.
 * Here, we will use the data service directly.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './new-instance-dialog.component.html',
  styleUrls: ['./new-instance-dialog.component.scss']
})
export class NewInstanceDialogComponent implements OnInit {
  selected = this.attriuteValue.attribute.allowedClases![0];
  schemaClasses: string[] = [this.attriuteValue.attribute.allowedClases![0], "Complex", "Polymer", "Protein"];
  instance: Instance | undefined;
  // avoid reset the displayed instance
  private is_assigned: boolean = false;

  constructor(@Inject(MAT_DIALOG_DATA) public attriuteValue: AttributeValue,
    public dialogRef: MatDialogRef<NewInstanceDialogComponent>,
    private dataService: DataService) { }

  ngOnInit(): void {
    // Fire an action to create a new instance.
    // Use the first allowable schema class for the time being
    // TODO: Create a list for concrete SchemaClasses only.
    this.dataService.createNewInstance(this.attriuteValue.attribute.allowedClases![0]).subscribe(instance => {
      this.instance = instance;
    }
    );
  }

  onSelectionChange(): void {
    console.log('selected' + this.selected)
    this.dataService.createNewInstance(this.selected).subscribe(instance => {
        this.instance = instance;
      }
    );
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    // Just return the instance newly created. Don't close it. The template
    // will handle close.
    this.dataService.registerNewInstance(this.instance!);
    this.dialogRef.close(this.instance);
  }
}
