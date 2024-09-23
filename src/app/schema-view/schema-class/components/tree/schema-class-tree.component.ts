import { FlatTreeControl } from "@angular/cdk/tree";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { Router } from "@angular/router";
import { Store } from "@ngrx/store";
import { Subscription } from "rxjs";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { EDIT_ACTION } from "src/app/instance/components/instance-view/instance-table/instance-table.model";
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import { SchemaClass } from "../../../../core/models/reactome-schema.model";
import { DataService } from "../../../../core/services/data.service";

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
export class SchemaClassTreeComponent implements OnInit, OnDestroy {
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
    (node: SchemaClassNode) => node.level,
    (node: SchemaClassNode) => node.expandable,
    // required by API
    (schemaClass: SchemaClass) => schemaClass.children ?? [],
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  private updateTreeHandler: Subscription|undefined;

  constructor(private service: DataService, 
    private router: Router, 
    private store: Store,
    private instUtils: InstanceUtilities,
    private cdr: ChangeDetectorRef) {
  }

  // When the component change from hidden to show, this method will be called
  // therefore loadSchemaTree
  ngOnInit(): void {
    this.loadSchemaTree();
    // This view is on and off. Therefore, we need to turn this on and off 
    // to avoid it is called multiple times
    this.updateTreeHandler = this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newNewDbId]) => {
      // In the future, we may load the counts for related classes only
      // to improve the performance. For the time beling, just 
      // reload everything.
      this.loadSchemaTree(true); // Force to reload 
    });
  }

  ngOnDestroy(): void {
    this.updateTreeHandler?.unsubscribe();
  }

  private loadSchemaTree(skipCache?: boolean) {
    this.service.fetchSchemaClassTree(skipCache).subscribe(data => {
      this.dataSource.data = [data]
      this.treeControl.expandAll();
    });
  }

  hasChild = (_: number, node: SchemaClassNode) => node.expandable;

  createNewInstance(schemaClassName: string) {
    this.service.createNewInstance(schemaClassName).subscribe(instance => {
      this.service.registerInstance(instance);
      this.store.dispatch(NewInstanceActions.register_new_instance(instance));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/schema_view/instance/" + dbId]);
    });
  }

  protected readonly EDIT_ACTION = EDIT_ACTION;
}
