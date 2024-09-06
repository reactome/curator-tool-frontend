import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {DataService} from "../../../../core/services/data.service";
import {Router} from "@angular/router";

/**
 * A dialog component to show referrers of an instance.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './confirm-delete-dialog.component.html',
  styleUrls: ['./confirm-delete-dialog.component.scss']
})
export class ConfirmDeleteDialogComponent {
  selected: string = '';

  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
              public dialogRef: MatDialogRef<ConfirmDeleteDialogComponent>,
              public dataService: DataService,
              private router: Router,) {
  }


  onCancel() {
    this.dialogRef.close();
  }

  onDelete() {
    this.dataService.delete(this.instance!).subscribe(storedInst => {
      console.debug('Returned dbId: ' + storedInst);
    });
    this.dialogRef.close(this.instance);
    this.router.navigate(["/schema_view"])

  }
}
