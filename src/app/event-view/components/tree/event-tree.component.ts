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
  rootNode: boolean;
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
      inFocus: false,
      rootNode: false
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
      service.fetchEventTree(false, "All").subscribe(data => {
        this.dataSource.data = [data]
        // Note: this.treeControl.expandAll() here breaks the page - hence we expand just one level from the top node
        let rootNode = this.treeControl.dataNodes[0];
        this.treeControl.expand(rootNode);
        this.showProgressSpinner = false;
        // The following is needed to hide the top (dummy) node
        this.filterData(['All']);
      })
  }

  hasChild = (_: number, node: EventNode) => node.expandable;

  inFocus = (node: EventNode) => node.inFocus;

  filterData(searchFilters: Array<string | undefined>, ) {
    let speciesFilter = searchFilters[0] as string;
    let searchKey = searchFilters[1];
    this.showProgressSpinner = true;
    this.service.fetchEventTree(true, speciesFilter, searchKey).subscribe(data => {
      this.showProgressSpinner = false;
      this.dataSource.data = [data];
      let rootNode = this.treeControl.dataNodes[0];
      this.treeControl.expand(rootNode);
      // Tag root (dummy) node so that the corresponding element can be hidden when the tree is displayed
      rootNode.rootNode = true;
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
      // Hide root (dummy) node
      const rootNodeElement = document.querySelector('.rootNode') as HTMLElement;
      rootNodeElement.style.display = "none";
      // Scroll to the first matching node of the tree
      if (focus) {
        const element = document.querySelector('.inFocus') as HTMLElement;
        element.scrollIntoView({behavior: 'smooth'});
      } else if (searchKey != undefined) {
        let snackBarRef = this._snackBar.open(
          'No data matching search key: ' + searchKey, 'Close',
          {
            horizontalPosition: 'center',
            verticalPosition: 'top'
           });
      }
    })
  }

  protected readonly EDIT_ACTION = EDIT_ACTION;
}
