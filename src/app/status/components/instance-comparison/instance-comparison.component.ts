import {Attribute, Component, Input, OnInit} from '@angular/core';
import {Store} from "@ngrx/store";
import {InstanceActions} from "../../../instance/state/instance.actions";
import {selectViewInstance} from "../../../instance/state/instance.selectors";
import {Instance} from "../../../core/models/reactome-instance.model";
import {DataService} from "../../../core/services/data.service";
import {AttributeCategory} from "../../../core/models/reactome-schema.model";

@Component({
  selector: 'app-compare-updated-instance',
  templateUrl: './instance-comparison.component.html',
  styleUrls: ['./instance-comparison.component.scss']
})
export class CompareUpdatedInstanceComponent implements OnInit {
  editedInstance: Instance | undefined;
  dbInstance: Instance | undefined;
  displayedColumns: string[] = ['name', 'value'];
  @Input() dbId: number = 141429;
  attributes: Attribute[] = [];

  constructor(private store: Store, private service: DataService) {
  }

  ngOnInit() {
    this.store.dispatch(InstanceActions.get_instance({dbId: this.dbId}));
    // Get the view instance to be displayed here
    this.store.select(selectViewInstance()).subscribe(instance => {
      this.editedInstance = instance;
      console.log(instance.modifiedAttributes);
    })
    // TODO: consider edits made from other curators
    this.service.fetchInstanceFromDatabase(this.dbId).subscribe(instance => {
      this.dbInstance = instance
    });
    this.getModifiedAttributes();
  }

  getModifiedAttributes() {
    if (this.editedInstance?.attributes) {
      let modAtt: Map<string, any> = new Map<string, any>();
      for (let attribute of this.editedInstance?.attributes) {
        if (this.editedInstance?.modifiedAttributes?.includes(attribute[0])) {
          modAtt.set(attribute[0], attribute[1]);
          attribute.push(attribute);
        }
      }
      this.editedInstance = {...this.editedInstance}
      this.editedInstance!.attributes = modAtt;
      // console.log("modAtt", this.editedInstance)
      // this.dbInstance!.attributes = modAtt;
    }
  }

  protected readonly AttributeCategory = AttributeCategory;
}
