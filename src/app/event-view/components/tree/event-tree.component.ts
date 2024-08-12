import { FlatTreeControl } from "@angular/cdk/tree";
import {ChangeDetectorRef, Component, EventEmitter, Output, Input, OnDestroy} from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import {AttributeCondition, Instance} from "../../../core/models/reactome-instance.model";
import { DataService } from "../../../core/services/data.service";
import { EDIT_ACTION } from "../../../instance/components/instance-view/instance-table/instance-table.model";
import {MatSnackBar} from '@angular/material/snack-bar'
import {DataSubjectService} from "src/app/core/services/data.subject.service";
import {Subscription} from 'rxjs';
import { ActivatedRoute, Router } from "@angular/router";

/** Tree node with expandable and level information */
//TODO: EventNode should wrap an Instance to make the data straucture easier
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
  hasDiagram: boolean,
  rootNode: boolean;
}

@Component({
  selector: 'app-event-tree',
  templateUrl: './event-tree.component.html',
  styleUrls: ['./event-tree.component.scss']
})
export class EventTreeComponent implements OnDestroy {
  // Listen to add to diagram view event
  @Output() addToDiagram = new EventEmitter<Instance>;
  showProgressSpinner: boolean = true;
  dbIdSubscription: Subscription;
  eventTreeParamSubscription: Subscription;
  private _transformer = (node: Instance, level: number) => {
    // TODO: Why does Typescript think that node.attributes is an Object and not a Map (has/get/set methods don't work)
    return {
      expandable: node.attributes && (node.attributes["hasEvent"] ?? []).length > 0,
      name: node.displayName ?? "",
      level: level,
      dbId: node.dbId,
      className: node.schemaClassName,
      doRelease: node.attributes && node.attributes["_doRelease"],
      match: node.attributes && node.attributes["match"],
      expand: node.attributes && node.attributes["expand"],
      inFocus: false,
      hasDiagram: node.attributes?.['hasDiagram'] ?? false,
      rootNode: node.displayName === "TopLevelPathway" ? true : false
    };
  };

  ngOnDestroy() {
    this.dbIdSubscription.unsubscribe();
    this.eventTreeParamSubscription.unsubscribe();
  }

  treeControl = new FlatTreeControl<EventNode>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    (eventNode: EventNode) => eventNode.level,
    (eventNode: EventNode) => eventNode.expandable,
    // This is quite weird: the types are different!
    (instance: Instance) => instance.attributes["hasEvent"] ?? []
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor(
    private cdr: ChangeDetectorRef,
    private service: DataService,
    private _snackBar: MatSnackBar,
    private dataSubjectService: DataSubjectService,
    private router: Router) {
      this.eventTreeParamSubscription = this.dataSubjectService.eventTreeParam$.subscribe(eventTreeParam => {
        if (eventTreeParam) {
          // Update the tree in response to the user clicking a node in the event tree
          let selectedParams: string = eventTreeParam.split(",")[0];
          let parentParams: string = eventTreeParam.split(",")[1];
          let selectedDbId = parseInt(selectedParams.split(":")[0]);
          let parentDbId = parseInt(parentParams.split(":")[0]);
          this.highlightSelected(selectedDbId, parentDbId);
          this.cdr.detectChanges();
        }
      });
      this.dbIdSubscription = this.dataSubjectService.dbId$.subscribe(dbId => {
        if (dbId !== "0") {
          // Update the tree in response to the user clicking on an instance link in instance view
          this.filterData([["All"], [""],["dbId"],["primitive"],["Equals"], [dbId]], true);
        }
      });

      let url = window.location.href.split("/");
      let dbId = url.slice(-1)[0];
      if (dbId !== "0") {
         // Update the tree based on the dbId provided in the URL
         this.filterData([["All"], [""],["dbId"],["primitive"],["Equals"], [dbId]], true);
      } else {
        // Otherwise just retrieve the full tree
        service.fetchEventTree(false, "All", "", [], [], [], []).subscribe(data => {
          this.dataSource.data = [data];
          this.showProgressSpinner = false;
          // Expand the root note and tag it as rootNode - so that it can be hidden in html
          let rootNode = this.treeControl.dataNodes[0];
          this.treeControl.expand(rootNode);
        });
      }
  }

  hasChild = (_: number, node: EventNode) => node.expandable;

  inFocus = (_: number, node: EventNode) => node.inFocus;
  isRootNode = (_: number, node: EventNode) => node.rootNode;

  atLeastOneQueryClausePresent(selectedOperands: string[], searchKeys: string[]): boolean {
    let ret = selectedOperands.includes("IS NULL") || selectedOperands.includes("IS NOT NULL");
    if (!ret) {
      let sks = new Set(searchKeys);
      ret = sks.size > 1 || sks.values().next().value !== "na";
    }
    return ret;
  }

  // Highlight in the event tree the node corresponding to the event selected by the user within the plot
  // (and remove highlighting from all the other nodes); also - expand the parent node of the selected one -
  // in order to bring the selected one into view.
  highlightSelected(selectedDbId: number, parentDbId: number) {
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
  }


  // NB by GW: For the time being, we will not enable this feature.
  generatePlot(dbId: string, className: string) {
    let plotParam = dbId + ":" + className;
    this.dataSubjectService.setPlotParam(plotParam);
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

  handleEventClick(event: EventNode) {
    const diagramNode = this.findAncestorDiagramNode(event);
    if (diagramNode) {
      if (diagramNode === event) {
        this.router.navigate(['/event_view/instance/' + diagramNode.dbId]);
      }
      else {
        this.router.navigate(['/event_view/instance/' + diagramNode.dbId],
          {queryParams: {select: event.dbId}, queryParamsHandling: 'merge'});
      }
    }
    else {
      console.debug('Cannot find a higher level pathway having diagram for ' + event.name);
    }
  }

  searchInstances(criteria: AttributeCondition[]) {

  }

  filterData(searchFilters: Array<string[]>, generatePlot?: boolean) {
    let schemaClass: string = "";
    let selectedSpecies = searchFilters[0][0] as string;
    let selectedClass = searchFilters[1][0] as string;
    let selectedAttributes = searchFilters[2];
    let selectedAttributeTypes = searchFilters[3];
    let selectedOperands = searchFilters[4];
    let searchKeys = searchFilters[5];
    if (selectedClass !== "") {
      schemaClass = selectedClass;
    }
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
        if (node.match && schemaClass === "") {
          // ie. When filterData is run using dbId provided in the URL
          schemaClass = node.className;
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
        // let snackBarRef = this._snackBar.open(
        //   'No data matching the query', '',
        //   {
        //     horizontalPosition: 'center',
        //     verticalPosition: 'top',
        //     duration: 4000
        //    });
      }
      if (generatePlot !== undefined || generatePlot === true) {
        // This is used when dbId is taken from the URL
        let plotParam = searchKeys[0] + ":" + schemaClass;
        this.dataSubjectService.setPlotParam(plotParam);
      }
    });
  }
  protected readonly EDIT_ACTION = EDIT_ACTION;

  addToDiagramAction(node: EventNode) {
    // Wrap the needed informatio into an instance and then fire
    const instance : Instance = {
      dbId: node.dbId,
      displayName: node.name,
      schemaClassName: node.className
    }
    this.addToDiagram.emit(instance);
  }

  /**
   * This method is used to find a tree node that has diagram. 
   * @param TreeNode 
   * @param currentNode 
   */
  private findAncestorDiagramNode(node: EventNode) {
    if (node.hasDiagram)
      return node; // Just itself
    const dataNodes = this.treeControl.dataNodes;
    let currentNode = node;
    while (true) {
      const currentIndex = dataNodes.indexOf(currentNode);
      // Reach to the top. Nothing to do
      if (currentIndex == 0)
        break;
      // Find its parent
      for (let i = currentIndex - 1; i >= 0; i--) {
        const nextNode = dataNodes[i];
        if (nextNode.level < currentNode.level) {
          // nextNode is currentNode's parent
          if (nextNode.hasDiagram)
            return nextNode;
          currentNode = nextNode;
          break; // Go to next cycle
        }
      }
    }
    return undefined;
  }

}
