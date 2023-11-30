import { Component } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';

@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss']
})
export class UpdatedInstanceListComponent {
  constructor(private _bottomSheetRef: MatBottomSheetRef<UpdatedInstanceListComponent>) {
    
  }

}
