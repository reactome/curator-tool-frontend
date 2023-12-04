import { Component, Inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Instance } from 'src/app/core/models/reactome-instance.model';

@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss'],
  standalone: true,
  imports: [MatListModule, MatButtonModule, MatTableModule, MatIconModule, MatCheckboxModule], 
})
export class UpdatedInstanceListComponent {

  displayedColumns: string[] = ['dbId', 'displayName', 'compareInstance', 'check'];
  matDataSource = new MatTableDataSource<Instance>();
  // instances to be comitted
  toBeUploaded: Instance[] = [];

  constructor(private _bottomSheetRef: MatBottomSheetRef<UpdatedInstanceListComponent>,
              @Inject(MAT_BOTTOM_SHEET_DATA) public data: {updated_instances: Instance[]}) {
    this.matDataSource.data = this.data.updated_instances;
    this.toBeUploaded = [...this.data.updated_instances]
  }

  close() {
    this._bottomSheetRef.dismiss();
  }

  commit() {
    this._bottomSheetRef.dismiss();
  }

  compareWithDB(instance: Instance) {
    alert("Compare the updated instance with the db version")
  }

  onSelectionChange(instance: Instance, event: MatCheckboxChange) {
    let index = this.toBeUploaded.indexOf(instance);
    if (event.checked) {
      if (index < 0) 
        this.toBeUploaded.push(instance);
    }
    else {
      if (index > -1)
        this.toBeUploaded.splice(index, 1);
    }
    console.debug('Instances to be uploaded: ' + this.toBeUploaded.length);
  }

}
