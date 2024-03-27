import { FlatTreeControl } from "@angular/cdk/tree";
import {ChangeDetectorRef, Component} from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { Router } from "@angular/router";
import { Store } from "@ngrx/store";
import {Instance} from "../../../core/models/reactome-instance.model";
import { DataService } from "../../../core/services/data.service";
import { EDIT_ACTION } from "../../../instance/components/instance-view/instance-table/instance-table.model";

/** Tree node with expandable and level information */
interface EventNode {
  expandable: boolean;
  name: string;
  level: number;
  dbId: string;
  className: string;
  doRelease: boolean;
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
      doRelease: !!node.attributes && node.attributes["_doRelease"] as boolean
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

  // TODO: Eliminate @ts-ignore below
  // @ts-ignore
  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor(
    private cdr: ChangeDetectorRef,
    private service: DataService,
    private router: Router,
    private store: Store) {
      service.fetchEventTree(false).subscribe(data => {
        this.dataSource.data = [data]
        // Note: this.treeControl.expandAll() here breaks the page - hence we expand just one level from the top node
        this.treeControl.expand(this.treeControl.dataNodes[0]);
        this.showProgressSpinner = false;
      })
  }

  hasChild = (_: number, node: EventNode) => node.expandable;

  filterData(speciesFilter: string) {
    this.showProgressSpinner = true;
    this.service.fetchEventTree(true).subscribe(data => {
      let filteredTopEvents: Array<Instance>;
      filteredTopEvents = [];
      data.attributes["hasEvent"]?.forEach((event: Instance): void => {
        if (speciesFilter == 'All' ||
          (event.attributes["speciesName"] === speciesFilter)) {
          filteredTopEvents.push(event)
        }
      });
      this.showProgressSpinner = false;
      data.attributes["hasEvent"] = filteredTopEvents;
      this.dataSource.data = [data];
      this.treeControl.expand(this.treeControl.dataNodes[0]);
      this.cdr.detectChanges();
    })
  }

  protected readonly EDIT_ACTION = EDIT_ACTION;
}
