import { FlatTreeControl } from "@angular/cdk/tree";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { Router } from "@angular/router";
import { Store } from "@ngrx/store";
import { Observable, Subscription, take } from "rxjs";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { EDIT_ACTION } from "src/app/instance/components/instance-view/instance-table/instance-table.model";
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import { SchemaClass } from "../../../../core/models/reactome-schema.model";
import { DataService } from "../../../../core/services/data.service";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { deleteInstances, newInstances, updatedInstances } from "src/app/instance/state/instance.selectors";
import { combineLatest } from "rxjs";


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

  private name2schemaClass: Map<string, SchemaClass> = new Map<string, SchemaClass>();
  private localCountMap: Map<string, number> = new Map<string, number>();

  private _getCountFromDatabase = (schemaCls: SchemaClass): number => {
    let count = schemaCls.count ? schemaCls.count : 0;
    return count;
  }

  private _getLocalCount = (schemaCls: SchemaClass): number => {
    let count = this.localCountMap.get(schemaCls.name) ?? 0;
    return count;
  }

  setUpLocalCount() {
    combineLatest([
      this.store.select(deleteInstances()),
      this.store.select(newInstances()),
      this.store.select(updatedInstances())
    ]).subscribe(([deleted, created, updated]) => {
      this._setUpLocalCount(deleted, created, updated); // Reload the tree to update local counts
    });
  }

  private _setUpLocalCount(deleted: Instance[], created: Instance[], updated: Instance[]) {
    this.resetLocalCounts();
    const allInstances = [...deleted, ...created, ...updated];
    allInstances.forEach(inst => {
      let schemaClass = this.name2schemaClass.get(inst.schemaClassName);
      if (schemaClass) {
        this._incrementLocalCount(schemaClass);
      }
    });
    this.loadSchemaTree(false); 
  }

  // reset local counts to brute force recalculation
  // always reset counts and then recalculate
  private resetLocalCounts() {
    this.localCountMap.clear();
  }


  // 'incrementLocalCount' recursively from child to parent 
  // listening to getLocalCount, 
  private _incrementLocalCount(schemaCls: SchemaClass) {
    let currentCount = this.localCountMap.get(schemaCls.name) ?? 0;
    this.localCountMap.set(schemaCls.name, currentCount + 1);
    // recursively increment parent class localCount
    if (schemaCls.parent) {
      this._incrementLocalCount(schemaCls.parent);
    }
  }


  private _isSchemaClassOf = () => {
    let root = this.dataSource.data.at(0);

    // Recursively build a map of each schema class and its children
    const buildChildrenMap = (node: SchemaClass, map: Map<string, SchemaClass[]>) => {
      if (!node) return;
      map.set(node.name, node.children ?? []);
      (node.children ?? []).forEach(child => buildChildrenMap(child, map));
    };

    const childrenMap = new Map<string, SchemaClass[]>();
    buildChildrenMap(root!, childrenMap);
  }

  private _isSchemaClass = (schemaCls: SchemaClass, clsName: string): boolean => {
    if (schemaCls.name === clsName) {
      return true;
    }
    let descendants = this._getDescendants(schemaCls);
    return descendants.has(clsName);
  }

  private _getDescendants = (schemaCls: SchemaClass): Set<string> => {
    if (schemaCls.descendants) {
      return schemaCls.descendants;
    }
    let descendants = new Set<string>();
    if (schemaCls.children) {
      schemaCls.children.forEach(child => {
        descendants.add(child.name);
        let childDescendants = this._getDescendants(child);
        childDescendants.forEach(descendant => descendants.add(descendant));
      });
    }
    schemaCls.descendants = descendants;
    return descendants;
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

  private subscription: Subscription = new Subscription();

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
    this.setUpLocalCount();
    // This view is on and off. Therefore, we need to turn this on and off 
    // to avoid it is called multiple times
    const updateTreeHandler = this.instUtils.committedNewInstDbId$.subscribe(([oldDbId, newNewDbId]) => {
      // In the future, we may load the counts for related classes only
      // to improve the performance. For the time beling, just 
      // reload everything.
      this.loadSchemaTree(true); // Force to reload 
    });
    this.subscription.add(updateTreeHandler);
    // this.setUpLocalCountOnce();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadSchemaTree(skipCache?: boolean) {
    // Take one only so that we don't need to unsubscribe
    this.service.fetchSchemaClassTree(skipCache).pipe(take(1)).subscribe(data => {
      this.dataSource.data = [data]
      this.name2schemaClass.clear();
      const buildMap = (schemaClass: SchemaClass) => {
        this.name2schemaClass.set(schemaClass.name, schemaClass);
        (schemaClass.children ?? []).forEach(child => buildMap(child));
      };
      buildMap(data);
      this.treeControl.expandAll();
    });
  }

  hasChild = (_: number, node: SchemaClassNode) => node.expandable;

  createNewInstance(schemaClassName: string) {
    this.service.createNewInstance(schemaClassName).subscribe(instance => {
      this.service.registerInstance(instance);
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtils.makeShell(instance)));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/schema_view/instance/" + dbId]);
    });
  }

  protected readonly EDIT_ACTION = EDIT_ACTION;
}
