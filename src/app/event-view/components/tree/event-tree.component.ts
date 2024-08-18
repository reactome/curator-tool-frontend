import { FlatTreeControl } from "@angular/cdk/tree";
import { ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { AttributeCondition, Instance } from "../../../core/models/reactome-instance.model";
import { DataService } from "../../../core/services/data.service";
import { ActivatedRoute, Router } from "@angular/router";
import { take } from "rxjs";

/** Tree node with expandable and level information */
// TODO: 1). After the tree loaded, do a path to set up parent for each navigation; 
// 2). Record the path that is used to set the router url which is used to load the diagram
// 3). If the path exists from 2 and it is open. Don't open anything!
// NOTE: TRIED NestTreeControl. It cannot work! Don't try again until having more ideas!!!
interface EventNode {
  expandable: boolean;
  name: string;
  level: number;
  dbId: number;
  className: string;
  doRelease: boolean;
  hilite: boolean;
  hasDiagram: boolean,
  rootNode: boolean,
  parent: EventNode | undefined,
  children: EventNode[] | undefined
}

@Component({
  selector: 'app-event-tree',
  templateUrl: './event-tree.component.html',
  styleUrls: ['./event-tree.component.scss']
})
export class EventTreeComponent {
  // Listen to add to diagram view event
  @Output() addToDiagram = new EventEmitter<Instance>;
  @Output() eventClicked = new EventEmitter<number>;
  
  // To track the diagram path when the diagram is opened by clicking
  diagramNodePath: EventNode[] | undefined;
  // tracked highlighted nodes to avoid checking all nodes
  highlightedNodes: EventNode[] = [];
  // A flag to avoid selection conflict
  selectionFromTree: boolean = false;

  showProgressSpinner: boolean = true;

  private _transformer = (node: Instance, level: number) => {
    // TODO: Why does Typescript think that node.attributes is an Object and not a Map (has/get/set methods don't work)
    // The reason is that attributes are converted directly from JSON in the data service!!! Need to think about it!
    // Consider to wrap instance inside EventNode to make this interface simpler.
    return {
      expandable: node.attributes && (node.attributes["hasEvent"] ?? []).length > 0,
      name: node.displayName ?? "",
      level: level,
      dbId: node.dbId,
      className: node.schemaClassName,
      doRelease: node.attributes && node.attributes["_doRelease"],
      hilite: false,
      hasDiagram: node.attributes?.['hasDiagram'] ?? false,
      rootNode: node.displayName === "TopLevelPathway" ? true : false,
      parent: undefined,
      children: undefined
    };
  };

  treeControl = new FlatTreeControl<EventNode>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    (eventNode: EventNode) => eventNode.level,
    (eventNode: EventNode) => eventNode.expandable,
    // Required by API
    (instance: Instance) => instance.attributes["hasEvent"] ?? []
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor(
    private cdr: ChangeDetectorRef,
    private service: DataService,
    private route: ActivatedRoute,
    private router: Router) {
      // Make sure this is called only once using take(1)
    this.route.params.pipe(take(1)).subscribe(params => {
      console.debug('handling route param in event tree: ', params);
      // We call this only once. Therefore, always need to load the tree
      service.fetchEventTree(false, 'Homo sapiens').subscribe(data => {
        this.dataSource.data = [data];
        this.showProgressSpinner = false;
        // Expand the root note and tag it as rootNode - so that it can be hidden in html
        let rootNode = this.treeControl.dataNodes[0];
        this.treeControl.expand(rootNode);
        // Cache the tree parent/child relationship for performance
        this.cacheTreePaths();
        const diagramPathwayId = Number(params['id']);
        const select = Number(this.route.snapshot.queryParams['select']);
        this.selectNodes(select ? select : diagramPathwayId, diagramPathwayId);
      });
    });
  }

  hasChild = (_: number, node: EventNode) => node.expandable;

  isRootNode = (_: number, node: EventNode) => node.rootNode;

  private cacheTreePaths() {
    if (this.treeControl === undefined || this.treeControl.dataNodes === undefined)
      return; // Just safegurard. Should not happen
    // Bottom up: the running time should be log(N) * N
    for (let i = this.treeControl.dataNodes.length - 1; i >= 0; i--) {
      const node = this.treeControl.dataNodes[i];
      // Find its parent node
      for (let j = i - 1; j >= 0; j--) {
        const other = this.treeControl.dataNodes[j];
        if (other.level < node.level) {
          node.parent = other;
          other.children ? other.children!.push(node): other.children = [node];
          break;
        }
      }
    }
  }

  // Highlight in the event tree the node corresponding to the event selected by the user within the plot
  // (and remove highlighting from all the other nodes); also - expand the parent node of the selected one -
  // in order to bring the selected one into view.
  private selectNodes(selectedDbId: number, diagramDbId: number) {
    if (this.treeControl === undefined || this.treeControl.dataNodes === undefined)
      return;
    if (selectedDbId === undefined || diagramDbId === undefined)
      return; // Nothing needs to be done
    let matchedNodes = [];
    for (let index = 0; index < this.treeControl.dataNodes.length; index ++) {
      let node = this.treeControl.dataNodes[index];
      if (node.dbId === selectedDbId) {
        matchedNodes.push(node);
      }
    }
    // Open the path to this node
    if (matchedNodes.length === 0)
      return;
    let matchedPath = undefined;
    for (let node of matchedNodes) {
      // There should be only one path for one node
      const path = this.getTreePath(node);
      if (path === undefined)
        continue;
      const pathIds = path.map(n => n.dbId)
      if (pathIds.includes(selectedDbId) && pathIds.includes(diagramDbId)) {
        matchedPath = path;
        // Expand the path
        for (let node1 of path)
          if (node1 !== node) // No need to open itself
            this.treeControl.expand(node1);
      }
    }
    this.highlightNodes(matchedNodes);
    // Keep the diagram node path for highlight
    if (matchedPath) {
      this.diagramNodePath = [];
      let include = false;
      for (let i = 0; i < matchedPath.length; i++) {
        const node = matchedPath[i];
        if (node.dbId === diagramDbId) {
          include = true;
          this.diagramNodePath.push(node);
        }
        else if (include)
          this.diagramNodePath.push(node);
      }
    }
    // There should be no use case for the following code. The selection synchronization between
    // the diagram selection and the tree selection is handled by selectNodesForDiagram(), which
    // handle scroll. 
  }

  selectNodesForDiagram(dbId: number) {
    // console.debug('Select nodes for diagram: ' + dbId);
    if (this.selectionFromTree) {
      this.selectionFromTree = false;
      return;
    }
    // Find the tree node under
    if (this.diagramNodePath === undefined || this.diagramNodePath.length === 0)
      return;
    const diagramNode = this.diagramNodePath[0];
    const current = [diagramNode]
    const next : EventNode[] = []
    const found = []
    while (current.length > 0) {
      for (let i = 0; i < current.length; i++) {
        if (current[i].dbId === dbId) {
          found.push(current[i]);
        }
        else {
          if (current[i].children) 
            current[i].children?.forEach(c => next.push(c))
        }
      }
      current.length = 0;
      next.forEach(c => current.push(c));
      next.length = 0;
    }
    this.highlightNodes(found);
    // Basically we cannot figure out a way to match the native element 
    // to the first node. Therefore, just let document to handle which node should
    // be focused
    // Need to use css
    const element = document.querySelector('.event_text_hilite') as HTMLElement;
    if (element && !this.elementsIsInView(element))
      element.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'nearest'});
  }

  private elementsIsInView(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  private highlightNodes(nodes: EventNode[]) {
    // Reset the previous hilited nodes
    for (let node of this.highlightedNodes.slice()) {
      node.hilite = false;
      this.highlightedNodes.pop();
    }
    for (let node of nodes) {
      node.hilite = true;
      this.highlightedNodes.push(node);
      // Expand its path
      const path = this.getTreePath(node);
      if (path)
        path.slice(1).forEach(node => this.treeControl.expand(node));
    }
  }

  handleEventClick(event: EventNode) {
    const diagramNode = this.findAncestorDiagramNode(event);
    if (diagramNode) {
      this.diagramNodePath = this.getTreePath(diagramNode);
      this.selectionFromTree = true;
      if (diagramNode === event) {
        this.router.navigate(['/event_view/instance/' + diagramNode.dbId]);
      }
      else {
        this.router.navigate(['/event_view/instance/' + diagramNode.dbId],
          {queryParams: {select: event.dbId}, queryParamsHandling: 'merge'});
      }
    }
    else {
      console.error('Cannot find a higher level pathway having diagram for ' + event.name);
    }
    this.highlightNodes([event]);
    this.eventClicked.emit(event.dbId);
  }

  //TODO: Use Deidre's new search interface
  searchInstances(criteria: AttributeCondition) {
  }

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
    const treePath = this.getTreePath(node);
    if (treePath === undefined)
      return undefined;
    for (let i = 1; i < treePath.length; i++) {
      const nextNode = treePath[i];
      if (nextNode.hasDiagram)
        return nextNode;
    }
    return undefined;
  }

  private getTreePath(node: EventNode) {
    const dataNodes = this.treeControl?.dataNodes;
    if (dataNodes === undefined)
      return undefined;
    const path: EventNode[] = [];
    this._getTreePath(node, dataNodes, path);
    return path;
  }

  private _getTreePath(node: EventNode, dataNodes: EventNode[], path: EventNode[]) {
    // Add the node itself
    path.push(node);
    if (node.parent)
      this._getTreePath(node.parent, dataNodes, path);
  }

}
