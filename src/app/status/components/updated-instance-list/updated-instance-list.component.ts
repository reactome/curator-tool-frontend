import { Component, Inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Instance } from 'src/app/core/models/reactome-instance.model';

@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss']
})
export class UpdatedInstanceListComponent {

  constructor(private _bottomSheetRef: MatBottomSheetRef<UpdatedInstanceListComponent>,
              @Inject(MAT_BOTTOM_SHEET_DATA) public data: {updated_instances: Instance[]}) {
  }

}
