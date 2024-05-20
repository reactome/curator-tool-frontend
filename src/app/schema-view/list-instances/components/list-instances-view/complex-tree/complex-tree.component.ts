import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FlatTreeControl } from "@angular/cdk/tree";
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import {Instance} from "src/app/core/models/reactome-instance.model";
import { DataService } from "src/app/core/services/data.service";


interface ComplexTreeNode {
  expandable: boolean;
  name: string;
  level: number;
  dbId: number;
  className: string;
  rootNode: boolean;
}

/**
 * A dialog component that is used to display the component tree below a given complex
 */
@Component({
  selector: 'complex-tree',
  templateUrl: './complex-tree.component.html',
  styleUrls: ['./complex-tree.component.scss']
})
export class ComplexTreeComponent {
  showProgressSpinner: boolean = true;

  private _transformer = (node: Instance, level: number) => {
    return {
      expandable: !!node.attributes && (node.attributes["hasComponent"] ?? []).length > 0,
      name: node.displayName ?? "",
      level: level,
      dbId: node.dbId,
      className: node.schemaClassName,
      rootNode: !!node.attributes && node.attributes["rootNode"] === true
    };
  };

  treeControl = new FlatTreeControl<ComplexTreeNode>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    node => node.level,
    node => node.expandable,
    node => !!node.attributes && (node.attributes["hasComponent"] ?? [])
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
  hasChild = (_: number, node: ComplexTreeNode) => node.expandable;
  isRootNode = (_: number, node: ComplexTreeNode) => node.rootNode;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public dbId: number,
              private service: DataService,
              public dialogRef: MatDialogRef<ComplexTreeComponent>) {
     service.fetchComplexTree(dbId).subscribe(data => {
         this.dataSource.data = [data];
         this.showProgressSpinner = false;
         // Expand all nodes
         this.treeControl.expandAll();
     });
  }
}
