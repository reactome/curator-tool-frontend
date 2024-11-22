import { FlatTreeControl } from "@angular/cdk/tree";
import { ChangeDetectorRef, Component, EventEmitter, inject, Output } from '@angular/core';
import { MatDialog } from "@angular/material/dialog";
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { ActivatedRoute, Router } from "@angular/router";
import { forkJoin, take } from "rxjs";
import { REACTION_TYPES } from "src/app/core/models/reactome-schema.model";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { InfoDialogComponent } from "src/app/shared/components/info-dialog/info-dialog.component";
import { Instance } from "../../../core/models/reactome-instance.model";
import { DataService } from "../../../core/services/data.service";

/** Tree node with expandable and level information */
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
  children: EventNode[] | undefined,
  species: string | undefined,
  hide: boolean,
  focus: boolean,
  instance: Instance, // data object
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
  @Output() createEmptyDiagramEvent = new EventEmitter<number>;
  
  // To track the diagram path when the diagram is opened by clicking
  diagramNodePath: EventNode[] | undefined;
  // tracked highlighted nodes to avoid checking all nodes
  highlightedNodes: EventNode[] = [];
  // A flag to avoid selection conflict
  selectionFromTree: boolean = false;

  // Track the current selected species
  private selectedSpecies: string = 'All'; // This is the default
  private filteredText: string = '';

  showProgressSpinner: boolean = true;

  // Cache tree nodes for editing
  private dbId2node = new Map<number, EventNode[]>();

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
      children: undefined,
      species: node.attributes?.['speciesName'] ?? undefined,
      hide: false,
      focus: false,
      instance: node,
    } as EventNode; // Add as EventNode to avoid the compiling complaining 
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

  hasChild = (_: number, node: EventNode) => node.expandable;

  isRootNode = (_: number, node: EventNode) => node.rootNode;

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  // To show information
  readonly dialog = inject(MatDialog);

  constructor(
    private cdr: ChangeDetectorRef,
    private service: DataService,
    private route: ActivatedRoute,
    private instUtils: InstanceUtilities,
    private router: Router) {
    // Make sure this is called only once using take(1)
    // We call this only once. Therefore, always need to load the tree
    this.route.params.pipe(take(1)).subscribe(params => {
      console.debug('handling route param in event tree: ', params);
      forkJoin({
        eventTree: service.fetchEventTree(false, 'all'),
        // Need to load schema class tree so that we can use it
        // to handle something like isReaction check in display name generator.
        schemaTree: service.fetchSchemaClassTree(false)
      }).subscribe({
        next: ({ eventTree, schemaTree }) => {
          this.processEventTreeData(eventTree, params['id']);
          // console.log('Second call response:', schemaTree);
          // Both server calls are now completed
        },
        error: (error) => {
          console.error('Error occurred:', error);
        }
      });
    });

    this.instUtils.lastUpdatedInstance$.subscribe(data => {
      this.handleEventEdit(data.attribute, data.instance);
    });

    this.instUtils.markDeletionDbId$.subscribe(dbId => {
      this.handleInstanceDeletion(dbId);
    });
  }

  private handleInstanceDeletion(dbId: number) {
    if (!this.treeControl || !this.treeControl.dataNodes)
      return;
    const treeNodes = this.dbId2node.get(dbId);
    if (!treeNodes)
      return;
    let needUpdate = false;
    for (let treeNode of treeNodes) {
      const parentInst = treeNode.parent?.instance;
      if (!parentInst)
        continue;
      const index = parentInst.attributes['hasEvent'].indexOf(treeNode.instance);
      if (index >= 0) {
        parentInst.attributes['hasEvent'].splice(index, 1);
        needUpdate = true;
      }
    }
    if (needUpdate) {
      const root = this.dbId2node.get(0)![0].instance;
      this.processEventTreeData(root, '');
    }
  }

  private handleEventEdit(attribute: string, event: Instance) {
    if (!this.treeControl || !this.treeControl.dataNodes)
      return; // Do nothing if there is nothing to do.
    if (attribute === 'name') {
      // Name can be updated automatically without making data update
      const treeNodes = this.dbId2node.get(event.dbId);
      if (!treeNodes)
        return;
      for (let treeNode of treeNodes) {
        if (treeNode.name !== event.displayName)
          treeNode.name = event.displayName ?? '';
      }
      return;
    }
    else if (attribute == 'hasEvent') {
      this.handleHasEventEdit(event);
    }
  }

  private handleHasEventEdit(event: Instance) {
    const treeNodes = this.dbId2node.get(event.dbId);
    if (!treeNodes || treeNodes.length === 0)
      return; // Nothing to do. This event is not in the current tree
    for (let treeNode of treeNodes) {
      // What we are really doing is to update the event instances
      // referred in the tree so that we can update the data source 
      // of the tree
      // For simplicity, just reset its hasEvent
      const treeInstHasEvent = [];
      if (event.attributes.get('hasEvent')) {
        for (let tmpInst of event.attributes.get('hasEvent')) {
          let tmpTreeInst = undefined;
          // See if there is any instance existing in the tree
          const tmpNodes = this.dbId2node.get(tmpInst.dbId);
          if (tmpNodes && tmpNodes.length > 0) {
            tmpTreeInst = tmpNodes[0].instance;
          }
          else {
            // Just use itself
            tmpTreeInst = tmpInst;
          }
          treeInstHasEvent.push(tmpTreeInst);
        }
      }
      treeNode.instance.attributes['hasEvent'] = treeInstHasEvent;
    }
    const root = this.dbId2node.get(0)![0].instance;
    this.processEventTreeData(root, '');
  }

  private copyNodesInfo() {
    if (this.dbId2node.size == 0)
      return; // Nothing to copy
    for (let node of this.treeControl.dataNodes) {
      const oldNodes = this.dbId2node.get(node.dbId);
      if (!oldNodes)
        continue;
      // Make sure the same level is used
      for (let oldNode of oldNodes) {
        if (oldNode.level === node.level) {
          // This is the node whose rendering information should be copied.
          node.hide = oldNode.hide;
          node.focus = oldNode.focus;
          node.hilite = oldNode.hilite;
          if (this.treeControl.isExpanded(oldNode))
            this.treeControl.expand(node);
          break;
        }
      }
    }
  }

  private processEventTreeData(data: any, paramsId: string) {
    this.dataSource.data = [data];
    this.showProgressSpinner = false;
    // Expand the root note and tag it as rootNode - so that it can be hidden in html
    let rootNode = this.treeControl.dataNodes[0];
    this.treeControl.expand(rootNode);
    this.copyNodesInfo();
    // Cache the tree parent/child relationship for performance
    this.cacheTreePaths();
    if (paramsId === '0')
      return; // This is just a flag
    const diagramPathwayId = Number(paramsId);
    const select = Number(this.route.snapshot.queryParams['select']);
    this.goToPathway(select, diagramPathwayId);
  }

  goToPathway(select: number | undefined, diagramPathwayId: number) {
    const matchedNodes = this.selectNodes(select ? select : diagramPathwayId, diagramPathwayId);
    // If no math, do nothing
    if (!matchedNodes || matchedNodes.length === 0)
      return;
    // If there is no diagram for the dbId, we need to re-route to load the diagram
    // This case occurs when a reaction is passed as dbId, e.g. localhost:4200/event_view/instance/9615721
    // or a pathway having no diagram is passed, http://localhost:4200/event_view/instance/69615
    // Check if the diagram node is this diagramPathwaId
    const diagramNode = this.findAncestorDiagramNode(matchedNodes[0]);
    if (!diagramNode) {
      // Need to show something here
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Information',
          message: 'Cannot find a diagram for ' + diagramPathwayId + '. Create an empty diagram for this event or its container pathway.'
        }
      });
      return; // Nothing to display
    }

    // if (diagramNode.dbId !== diagramPathwayId) {
    // Let's just used the first node right now
    this.navigateToEventNode(matchedNodes[0], select);
    // mimic a tree click event so that the instance can be shown in the instance view
    if (select)
      this.eventClicked.emit(select);
    else
      this.eventClicked.emit(matchedNodes[0].dbId);
    // }
    // else if (!select) {
    //   // Handle a case like this: http://localhost:4200/event_view/instance/9615710 for a pathway having diagram
    //   // Therefore, the pathway instance can be loaded in the instance view.
    //   // this.setDiagramNodePath(matchedNodes[0]);
    //   this.handleEventClick(matchedNodes[0]);
    //   // this.eventClicked.emit(diagramPathwayId);
    // }
  }

  private cacheTreePaths() {
    if (this.treeControl === undefined || this.treeControl.dataNodes === undefined)
      return; // Just safegurard. Should not happen
    // Bottom up: the running time should be log(N) * N
    this.dbId2node.clear();
    for (let i = this.treeControl.dataNodes.length - 1; i >= 0; i--) {
      const node = this.treeControl.dataNodes[i];
      if (this.dbId2node.has(node.dbId))
        this.dbId2node.get(node.dbId)?.push(node);
      else
        this.dbId2node.set(node.dbId, [node]);
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
  private selectNodes(selectedDbId: number, diagramDbId: number): EventNode[] | undefined {
    if (this.treeControl === undefined || this.treeControl.dataNodes === undefined)
      return undefined;
    if (selectedDbId === undefined || diagramDbId === undefined)
      return undefined; // Nothing needs to be done
    let matchedNodes = [];
    let matchedPath = undefined;
    for (let index = 0; index < this.treeControl.dataNodes.length; index ++) {
      let node = this.treeControl.dataNodes[index];
      if (node.dbId === selectedDbId) {
        // Also check the diagramdbId
        const treePath = this.getTreePath(node);
        if (treePath && treePath.map(n => n.dbId).includes(diagramDbId)) {
          matchedNodes.push(node);
          matchedPath = treePath;
        }
      }
    }
    // Open the path to this node
    if (matchedNodes.length === 0) {
      // In case the select is a pathway that is not contained by the diagram pathway
      if (selectedDbId !== diagramDbId)
        return this.selectNodes(diagramDbId, diagramDbId);
      return undefined;
    }
    this.highlightNodes(matchedNodes); 
    return matchedNodes;
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
    // Set the URL
    this.router.navigate(['/event_view/instance/' + diagramNode.dbId],
      {queryParams: {select: dbId}, queryParamsHandling: 'merge'});
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
    this.navigateToEventNode(event);
    this.highlightNodes([event]);
    this.eventClicked.emit(event.dbId);
  }

  private navigateToEventNode(event: EventNode, select: number|undefined = undefined) {
    const diagramNode = this.setDiagramNodePath(event);
    if (diagramNode) {
      if (diagramNode === event) {
        if (select) {
          this.router.navigate(['/event_view/instance/' + diagramNode.dbId],
          {queryParams: {select: select}});
        }
        else
          this.router.navigate(['/event_view/instance/' + diagramNode.dbId]);
      }
      else {
        this.selectionFromTree = true;
        this.router.navigate(['/event_view/instance/' + diagramNode.dbId],
          {queryParams: {select: event.dbId}, queryParamsHandling: 'merge'});
      }
    }
    else {
      // Need to show something here
      this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Information',
          message: 'Cannot find a diagram for the clicked event. Create an empty diagram first in the branch.'
        }
      });
      console.error('Cannot find a higher level pathway having diagram for ' + event.name);
    }
  }

  private setDiagramNodePath(event: EventNode) {
    const diagramNode = this.findAncestorDiagramNode(event);
    if (diagramNode) 
      this.diagramNodePath = this.getTreePath(diagramNode);
    return diagramNode;
  }

  createEmptyDiagram(node: EventNode) {
    this.createEmptyDiagramEvent.emit(node.dbId);
    // Wait a little bit
    setTimeout(() => {
      // Make sure the node get updated since it has diagram now
      for (let node1 of this.treeControl.dataNodes) {
        if (node1.dbId === node.dbId)
          node1.hasDiagram = true;
      }
      this.handleEventClick(node);
    }, 500);
  }

  needCreateEmptyDiagramBtn(node: EventNode) {
    if (REACTION_TYPES.includes(node.className))
      return false;
    if (node.hasDiagram)
      return false;
    return true;
  }

  addToDiagramAction(node: EventNode) {
    // Need to check if this node can be added to the displayed diagram
    // This check is applied to reaction only
    if (REACTION_TYPES.includes(node.className) && this.diagramNodePath) {
      const diagramNode = this.diagramNodePath[0];
      if (!this.isContainedBy(node, diagramNode)) {
          // Need to show something here
          this.dialog.open(InfoDialogComponent, {
          data: {
            title: 'Information',
            message: 'This event cannot be added into the diagram: it is not contained by the pathway.'
          }
        });
        return;
      }
    }
    // Wrap the needed information into an instance and then fire
    const instance : Instance = {
      dbId: node.dbId,
      displayName: node.name,
      schemaClassName: node.className
    }
    this.addToDiagram.emit(instance);
  }

  private isContainedBy(childNode: EventNode, diagramNode: EventNode) {
    const treePath = this.getTreePath(childNode);
    if (treePath === undefined)
      return true;
    // Since the event may be represented by multiple EventNode, we need to compare dbId
    return treePath.map(n => n.dbId).includes(diagramNode.dbId);
  }

  focusOnEvent(node: EventNode) {
    if (this.treeControl === undefined || this.treeControl.dataNodes === undefined)
      return;
    if (node.focus) { // Unfocus
      for (let node of this.treeControl.dataNodes) {
        node.hide = false;
        node.focus = false;
      }
    }
    else { // Doing focus
      // Get the nodes that should be shown
      const toBeShown = new Set<EventNode>();
      const treePath = this.getTreePath(node);
      treePath?.forEach(n => toBeShown.add(n));
      // Get the children
      this.grepDescendenants(node, toBeShown);
      for (let node of this.treeControl.dataNodes) {
        node.hide = !toBeShown.has(node);
        node.focus = false;
      }
      node.focus = true;
    }
  }

  grepDescendenants(node: EventNode, descendants: Set<EventNode>) {
    descendants.add(node);
    if (node.children === undefined)
      return;
    for (let child of node.children) {
      this.grepDescendenants(child, descendants);
    }
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

  selectSpecies(species: string) {
    if (this.selectedSpecies === species)
      return;
    this.selectedSpecies = species;
    this.updateTreeView();
  }

  filterEvents(text: string) {
    const query = text;
    if (this.filteredText === query)
      return; // Do nothing
    this.filteredText = query;
    this.updateTreeView();
  }

  private updateTreeView() {
    if (this.treeControl === undefined || this.treeControl.dataNodes === undefined)
      return;
    for (let node of this.treeControl.dataNodes) {
      node.hide = this.isNodeHidden(node);
      // highlight nodes for text
      if (this.filteredText.length > 0)
        node.hilite = !node.hide; // Make sure to highlight nodes that are matched.
      else if (!node.hide)
        node.hilite = false; // There should
    }
    // We want to make sure all parent nodes are displayed
    // Otherwise, intermediate and leaf nodes will not be displayed.
    for (let node of this.treeControl.dataNodes) {
      if (!node.hide) {
        const treePath = this.getTreePath(node);
        if (treePath === undefined)
          continue;
        treePath.forEach(n => {
          n.hide = false;
          // Only expand for text
          if (this.filteredText.length > 0)
            this.treeControl.expand(n);
        });
      }
    }
  }

  private isNodeHidden(node: EventNode) {
    if (this.selectedSpecies !== 'All' && this.selectedSpecies !== node.species) {
      return true;
    }
    if (this.filteredText !== '') {
      // Check if the text if an integer
      if (/^\d+$/.test(this.filteredText.trim())) {
        if (node.dbId === parseInt(this.filteredText.trim()))
          return false;
      }
      else if (node.name.includes(this.filteredText))
        return false;
      return true;
    }
    // Default should be displayed
    return false;
  }

}
