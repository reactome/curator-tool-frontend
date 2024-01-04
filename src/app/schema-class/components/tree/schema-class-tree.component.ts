import { FlatTreeControl } from "@angular/cdk/tree";
import { Component } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { Router } from "@angular/router";
import { Store } from "@ngrx/store";
import { SchemaClass } from "../../../core/models/reactome-schema.model";
import { DataService } from "../../../core/services/data.service";
import { EDIT_ACTION } from "../../../instance/components/instance-view/instance-table/instance-table.model";
import {NewInstanceActions} from "../../../instance/state/new-instance/new-instance.actions";

/** Tree node with expandable and level information */
interface SchemaClassNode {
  expandable: boolean;
  name: string;
  level: number;
  count: number;
  abstract: boolean;
}

@Component({
  selector: 'app-schema-class-tree',
  templateUrl: './schema-class-tree.component.html',
  styleUrls: ['./schema-class-tree.component.scss']
})
export class SchemaClassTreeComponent {
  private _transformer = (node: SchemaClass, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      count: node.count ?? 0,
      level: level,
      abstract: node.abstract ?? false, // Default is false
    };
  };

  treeControl = new FlatTreeControl<SchemaClassNode>(
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

  constructor(private service: DataService, private router: Router, private store: Store) {
    service.fetchSchemaClassTree().subscribe(data => {
      this.dataSource.data = [data]
      this.treeControl.expandAll();
    })
  }

  hasChild = (_: number, node: SchemaClassNode) => node.expandable;

  createNewInstance(schemaClassName: string) {
    this.service.createNewInstance(schemaClassName).subscribe(instance => {
      this.service.registerNewInstance(instance);
      this.store.dispatch(NewInstanceActions.register_new_instances(instance));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/instance_view/" + dbId]);
    });
  }

  protected readonly EDIT_ACTION = EDIT_ACTION;
}
