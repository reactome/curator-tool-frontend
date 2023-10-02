import { Component } from '@angular/core';
import {FlatTreeControl} from "@angular/cdk/tree";
import {MatTreeFlatDataSource, MatTreeFlattener} from "@angular/material/tree";
import {Data} from "@angular/router";
import {DataService} from "../../../core/services/data.service";
import {SchemaClass} from "../../../core/models/reactome-schema.model";
import {map} from "rxjs";

/** Flat node with expandable and level information */
interface ExampleFlatNode {
  expandable: boolean;
  name: string;
  level: number;
  count: number;
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
    };
  };

  treeControl = new FlatTreeControl<ExampleFlatNode>(
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

  constructor(private service: DataService) {
    service.fetchSchemaClassTree().subscribe( data => {
      this.dataSource.data = [data]
      this.treeControl.expandAll()
    })
  }

  hasChild = (_: number, node: ExampleFlatNode) => node.expandable;
}
