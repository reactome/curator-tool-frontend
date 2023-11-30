import { Component, OnInit } from '@angular/core';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { updatedInstances } from 'src/app/instance/state/instance.selectors';
import { UpdatedInstanceListComponent } from '../components/updated-instance-list/updated-instance-list.component';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatBottomSheetModule, MatListModule]
})
export class StatusComponent implements OnInit{
  updatedInstances: Instance[] = [];

  typesOfShoes: string[] = [
    'Boots',
    'Clogs',
    'Loafers',
    'Moccasins',
    'Sneakers',
  ];

  constructor(private store: Store, private _bottomSheet: MatBottomSheet) {
  }

  ngOnInit(): void {
    this.store.select(updatedInstances()).subscribe((instances) => {
      if (instances !== undefined)
        this.updatedInstances = instances;
    })
  }

  showUpdated(): void {
    console.debug("Show updated instances: " + this.updatedInstances.length)
    this._bottomSheet.open(UpdatedInstanceListComponent, {
      data: {updated_instances: this.updatedInstances},
    });
  }

}
