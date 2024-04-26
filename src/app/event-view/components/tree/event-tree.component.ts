import { FlatTreeControl } from "@angular/cdk/tree";
import {ChangeDetectorRef, Component, EventEmitter, Output, Input, OnChanges} from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
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
    private _snackBar: MatSnackBar) {
      service.fetchEventTree(false, "All", "", [], [], [], []).subscribe(data => {
        this.dataSource.data = [data];
        this.showProgressSpinner = false;
      });
  }

  @Output() generatePlotFromEventTreeSel = new EventEmitter<string>();
  @Input() dbIdAndClassNameFromPlotToEventTree: string = "";

  hasChild = (_: number, node: EventNode) => node.expandable;

  inFocus = (node: EventNode) => node.inFocus;

  atLeastOneQueryClausePresent(selectedOperands: string[], searchKeys: string[]): boolean {
    let ret = selectedOperands.includes("IS NULL") || selectedOperands.includes("IS NOT NULL");
    if (!ret) {
      let sks = new Set(searchKeys);
      ret = sks.size > 1 || sks.values().next().value !== "na";
    }
    return ret;
  }

  ngOnChanges() {
    if (this.dbIdAndClassNameFromPlotToEventTree) {
        let selectedParams: string = this.dbIdAndClassNameFromPlotToEventTree.split(",")[0];
        let parentParams: string = this.dbIdAndClassNameFromPlotToEventTree.split(",")[1];
        let selectedDbId = parseInt(selectedParams.split(":")[0]);
        let parentDbId = parseInt(parentParams.split(":")[0]);
        // Highlight in the event tree the node corresponding to the event selected by the user within the plot
        // (and remove highlighting from all the other nodes); also - expand the parent node of the selected one -
        // in order to bring the selected one into view.
        this.treeControl.dataNodes.forEach( (node) => {
          if (node.dbId === selectedDbId) {
            node.match = true;
          } else if (node.dbId === parentDbId) {
            this.treeControl.expand(node);
            node.match = false;
          } else {
            node.match = false;
          }
        });
        this.cdr.detectChanges();
    }
  }


  // Emit an event to the parent: side-navigation.component
  // (with the final destination of event-plot.component)
  generatePlotToSideNavigation(dbId: string, className: string) {
    let plotParam = dbId + ":" + className;
    this.generatePlotFromEventTreeSel.emit(plotParam);
    // Additionally, highlight in the event tree the node corresponding to the plot
    // about to be generated (and remove highlighting from all the other nodes)
    this.treeControl.dataNodes.forEach( (node) => {
      if (node.dbId === parseInt(dbId)) {
        node.match = true;
      } else {
        node.match = false;
      }
    });
    this.cdr.detectChanges();
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
