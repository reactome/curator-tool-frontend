import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { InstanceActions } from 'src/app/instance/state/instance.actions';
import { UPDATE_INSTANCES_STATE_NAME, updatedInstances } from 'src/app/instance/state/instance.selectors';

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss']
})
export class StatusComponent implements OnInit{
  updatedInstances: Instance[] = [];

  constructor(private store: Store) {
  }

  ngOnInit(): void {
    this.store.select(updatedInstances()).subscribe((instances) => {
      this.updatedInstances = instances;
    })
  }

}
