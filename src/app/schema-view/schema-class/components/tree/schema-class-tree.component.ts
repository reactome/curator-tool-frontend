import { FlatTreeControl } from "@angular/cdk/tree";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { Router } from "@angular/router";
import { Store } from "@ngrx/store";
import { Observable, Subscription, take } from "rxjs";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import { SchemaClass } from "../../../../core/models/reactome-schema.model";
import { DataService } from "../../../../core/services/data.service";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { deleteInstances, newInstances, updatedInstances } from "src/app/instance/state/instance.selectors";
import { combineLatest } from "rxjs";
import { EDIT_ACTION } from "src/app/instance/components/instance-view/instance-table/instance-table-comparison.model";
import { Data_testService } from "src/app/core/services/data_test.service";

/** Tree node with expandable and level information */
interface SchemaClassNode {
  expandable: boolean;
  name: string;
  level: number;
  count: number;
  localCount: number;
  abstract: boolean;
}
@Component({
  selector: 'app-schema-class-tree',
  templateUrl: './schema-class-tree.component.html',
  styleUrls: ['./schema-class-tree.component.scss']
})
export class SchemaClassTreeComponent implements OnInit, OnDestroy {
  protected readonly EDIT_ACTION = EDIT_ACTION;

  private _getCountFromDatabase = (schemaCls: SchemaClass): number => {
    let count = schemaCls.count ? schemaCls.count : 0;
    return count;
  }

  private _getLocalCount = (schemaCls: SchemaClass): number => {
    let count = schemaCls.localCount ?? 0;
    return count;
  }

  private _transformer = (node: SchemaClass, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      // count: node.count ?? 0,
      count: this._getCountFromDatabase(node),
      localCount: this._getLocalCount(node),
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
  hasChild = (_: number, node: SchemaClassNode) => node.expandable;

  private subscription: Subscription = new Subscription();

  constructor(private service: DataService,
    private router: Router,
    private store: Store,
    private instUtils: InstanceUtilities,
    private service_test: Data_testService,) {
  }

  // When the component change from hidden to show, this method will be called
  // therefore loadSchemaTree
  ngOnInit(): void {
    this.loadSchemaTree();
    // This view is on and off. Therefore, we need to turn this on and off 
    // to avoid it is called multiple times
    const updateTreeHandler = this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newNewDbId]) => {
      // In the future, we may load the counts for related classes only
      // to improve the performance. For the time beling, just 
      // reload everything.
      this.loadSchemaTree(true); // Force to reload 
    });
    this.subscription.add(updateTreeHandler);
    // Forces to reload the tree to update local counts
    const updateLocalCountHandler = combineLatest([
        this.store.select(deleteInstances()),
        this.store.select(newInstances()),
        this.store.select(updatedInstances())
      ]).subscribe(([deleted, created, updated]) => {
        this.loadSchemaTree(false); // Force to reload 
      });
    this.subscription.add(updateLocalCountHandler);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadSchemaTree(skipCache?: boolean) {
    // Take one only so that we don't need to unsubscribe
    this.service.fetchSchemaClassTree(skipCache).pipe(take(1)).subscribe(root => {
      // Need to load the local instances count
      combineLatest([
        this.store.select(deleteInstances()),
        this.store.select(newInstances()),
        this.store.select(updatedInstances())
      ]).pipe(take(1)).subscribe(([deleted, created, updated]) => {
        this.setUpLocalCount(deleted, created, updated, root); // Reload the tree to update local counts
        this.dataSource.data = [root]
        this.treeControl.expandAll();
      });
    });
  }

  createNewInstance(schemaClassName: string) {
    this.service.createNewInstance(schemaClassName).subscribe(instance => {
      this.service.registerInstance(instance);
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtils.makeShell(instance)));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/schema_view/instance/" + dbId]);
    });
  }

  testAllSchemaClasses() {
    this.service_test.createAndCommitAllConcreteSchemaClasses();
  }

  private setUpLocalCount(deleted: Instance[], created: Instance[], updated: Instance[], root: SchemaClass) {
    const allInstances = [...deleted, ...created, ...updated];
    // Make sure no duplicated instances
    const instanceMap = new Map<number, Instance>();
    allInstances.forEach(inst => {
      instanceMap.set(inst.dbId, inst);
    });
    // Get all schema classes involved
    const name2SchemaClass = new Map<string, SchemaClass>();
    // Build name2schemaClass map
    const buildName2SchemaClass = (schemaCls: SchemaClass) => {
      // Just in case
      schemaCls.localCount = 0;
      name2SchemaClass.set(schemaCls.name, schemaCls);
      if (schemaCls.children) {
        schemaCls.children.forEach(child => buildName2SchemaClass(child));
      }
    };
    buildName2SchemaClass(root);
    // Go over instanceMap one by one
    instanceMap.forEach(inst => {
      const schemaCls = name2SchemaClass.get(inst.schemaClassName);
      if (schemaCls) {
        this._incrementLocalCount(schemaCls);
      }
    });
  }

  // 'incrementLocalCount' recursively from child to parent 
  // listening to getLocalCount, 
  private _incrementLocalCount(schemaCls: SchemaClass) {
    schemaCls.localCount = (schemaCls.localCount ?? 0) + 1;
    // recursively increment parent class localCount
    if (schemaCls.parent) {
      this._incrementLocalCount(schemaCls.parent);
    }
  }
}
