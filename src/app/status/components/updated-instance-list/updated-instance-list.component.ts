import {Component, Inject, Input} from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import {
  CompareUpdatedInstanceDialogService
} from "../instance-comparison-dialog/instance-comparison-dialog.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss'],
  standalone: true,
  imports: [MatListModule, MatButtonModule, MatTableModule, MatIconModule, MatCheckboxModule],
})
export class UpdatedInstanceListComponent {
  @Input() data: Instance[] = [];
  displayedColumns: string[] = ['dbId', 'displayName', 'compareInstance', 'check'];
  matDataSource = new MatTableDataSource<Instance>();
  // instances to be committed
  toBeUploaded: Instance[] = [];

  // private _bottomSheetRef: MatBottomSheetRef<UpdatedInstanceListComponent>,
  // @Inject(MAT_BOTTOM_SHEET_DATA) public data: {updated_instances: Instance[]},
  constructor(private router: Router,) {
    this.matDataSource.data = this.data;
    this.toBeUploaded = [...this.data];
  }

  compareWithDB(instance: Instance) {
    this.router.navigate(["/instance_view/" + instance.dbId + "/" + "comparison"]);
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
