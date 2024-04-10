import { FlatTreeControl } from "@angular/cdk/tree";
import {ChangeDetectorRef, Component} from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { Router } from "@angular/router";
import { Store } from "@ngrx/store";
import {Instance} from "../../../core/models/reactome-instance.model";
import { DataService } from "../../../core/services/data.service";
import { EDIT_ACTION } from "../../../schema-view/instance/components/instance-view/instance-table/instance-table.model";
import {MatSnackBar} from '@angular/material/snack-bar'

/** Tree node with expandable and level information */
interface EventNode {
  expandable: boolean;
  name: string;
  level: number;
  dbId: number;
  className: string;
  doRelease: boolean;
  match: boolean;
  expand: boolean;
  inFocus: boolean;
}

@Component({
  selector: 'app-event-tree',
  templateUrl: './event-tree.component.html',
  styleUrls: ['./event-tree.component.scss']
})
export class EventTreeComponent {
  showProgressSpinner: boolean = true;
  private _transformer = (node: Instance, level: number) => {
    // TODO: Why does Typescript think that node.attributes is an Object and not a Map (has/get/set methods don't work)
    return {
      expandable: !!node.attributes && (node.attributes["hasEvent"] ?? []).length > 0,
      name: node.displayName ?? "",
      level: level,
      dbId: node.dbId,
      className: node.schemaClassName,
      doRelease: !!node.attributes && node.attributes["_doRelease"],
      match: !!node.attributes && node.attributes["match"],
      expand: !!node.attributes && node.attributes["expand"],
      inFocus: false
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
    node => node.attributes["hasEvent"] ?? []
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor(
    private cdr: ChangeDetectorRef,
    private service: DataService,
    private router: Router,
    private store: Store,
    private _snackBar: MatSnackBar) {
      let searchKey = undefined;
      service.fetchEventTree(false, "All", "", [], [], [], [])
        .subscribe(data => {
        this.dataSource.data = [data]
        this.showProgressSpinner = false;
      })
  }

  hasChild = (_: number, node: EventNode) => node.expandable;

  inFocus = (node: EventNode) => node.inFocus;

  atLeastOneQueryClausePresent(selectedOperands: string[], searchKeys: string[]): boolean {
    let ret = selectedOperands.includes("IS NULL") || selectedOperands.includes("IS NOT NULL");
    if (!ret) {
      let sks = new Set(searchKeys);
      ret = sks.size > 1 || !sks.values().next().value.equals("na");
    }
    return ret;
  }

  filterData(searchFilters: Array<string[]>) {
    let selectedSpecies = searchFilters[0][0] as string;
    let selectedClass = searchFilters[1][0] as string;
    let selectedAttributes = searchFilters[2];
    let selectedAttributeTypes = searchFilters[3];
    let selectedOperands = searchFilters[4];
    let searchKeys = searchFilters[5];
    this.showProgressSpinner = true;
    this.service.fetchEventTree(
      true,
       selectedSpecies,
       selectedClass,
       selectedAttributes,
       selectedAttributeTypes,
       selectedOperands,
       searchKeys).subscribe(data => {
      this.showProgressSpinner = false;
      this.dataSource.data = [data];
      let rootNode = this.treeControl.dataNodes[0];
      this.treeControl.expand(rootNode);
      let focus = false;
      this.treeControl.dataNodes.forEach( (node) => {
        if (node.expand) {
          this.treeControl.expand(node);
        }
        if (node.match && !focus) {
          node.inFocus = true;
          focus = true;
        }
      });
      this.cdr.detectChanges();
      // Scroll to the first matching node of the tree
      if (focus) {
        const element = document.querySelector('.inFocus') as HTMLElement;
        element.scrollIntoView({behavior: 'smooth'});
      } else if (this.atLeastOneQueryClausePresent(selectedOperands, searchKeys)) {
        let snackBarRef = this._snackBar.open(
          'No data matching the query', '',
          {
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 4000
           });
      }
    })
  }

  protected readonly EDIT_ACTION = EDIT_ACTION;
}
