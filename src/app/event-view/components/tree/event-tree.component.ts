import { FlatTreeControl } from "@angular/cdk/tree";
import {ChangeDetectorRef, Component} from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { Router } from "@angular/router";
import { Store } from "@ngrx/store";
import { SchemaClass } from "../../../core/models/reactome-schema.model";
import { DataService } from "../../../core/services/data.service";
import { EDIT_ACTION } from "../../../schema-view/instance/components/instance-view/instance-table/instance-table.model";
import {NewInstanceActions} from "../../../schema-view/instance/state/new-instance/new-instance.actions";


/** Tree node with expandable and level information */
interface EventNode {
  expandable: boolean;
  name: string;
  level: number;
  count: number;
  abstract: boolean;
}

@Component({
  selector: 'app-event-tree',
  templateUrl: './event-tree.component.html',
  styleUrls: ['./event-tree.component.scss']
})
export class EventTreeComponent {
  private _transformer = (node: SchemaClass, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      count: node.count ?? 0,
      level: level,
      abstract: node.abstract ?? false, // Default is false
    };
  };

  treeControl = new FlatTreeControl<EventNode>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    node => node.level,
    node => node.expandable,
    node => node.children,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor(
    private cdr: ChangeDetectorRef,
    private service: DataService,
    private router: Router,
    private store: Store) {
      service.fetchEventTree(false).subscribe(data => {
        this.dataSource.data = [data]
        this.treeControl.expandAll();
      })
  }

  hasChild = (_: number, node: EventNode) => node.expandable;

  createNewInstance(eventName: string) {
    this.service.createNewInstance(eventName).subscribe(instance => {
      this.service.registerNewInstance(instance);
      this.store.dispatch(NewInstanceActions.register_new_instances(instance));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/instance_view/" + dbId]);
    });
  }

  filterData(speciesFilter: string) {
    this.service.fetchEventTree(true).subscribe(data => {
      let filtered_children: SchemaClass[];
      filtered_children = [];
      data.children?.forEach((child): void => {
        if (child.name.includes(speciesFilter) || speciesFilter == 'All') {
          filtered_children.push(child)
        }
      });
      data.children = filtered_children;
      this.dataSource.data = [data];
      this.treeControl.expandAll();
      this.cdr.detectChanges();
    })
  }

  protected readonly EDIT_ACTION = EDIT_ACTION;
}
