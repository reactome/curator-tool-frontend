import {Component, Input, OnInit} from '@angular/core';
import {Store} from "@ngrx/store";
import {InstanceActions} from "../../../instance/state/instance.actions";
import {selectViewInstance} from "../../../instance/state/instance.selectors";
import {Instance} from "../../../core/models/reactome-instance.model";
import {DataService} from "../../../core/services/data.service";

@Component({
  selector: 'app-compare-updated-instance',
  templateUrl: './compare-updated-instance.component.html',
  styleUrls: ['./compare-updated-instance.component.scss']
})
export class CompareUpdatedInstanceComponent implements OnInit{
  editedInstance: Instance | undefined;
  dbInstance: Instance | undefined;
  @Input() dbId: number = 141429;

  constructor(private store: Store, private service: DataService) {
  }

  ngOnInit() {
    this.store.dispatch(InstanceActions.get_instance({dbId: this.dbId}));
    // Get the view instance to be displayed here
    this.store.select(selectViewInstance()).subscribe(instance => {
      this.editedInstance = instance;
      console.log(instance.modifiedAttributes);
    })
    this.service.fetchInstanceFromDatabase(this.dbId).subscribe(instance =>{
      this.dbInstance = instance
    });
  }
}
