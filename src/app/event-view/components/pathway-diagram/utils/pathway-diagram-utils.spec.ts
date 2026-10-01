// Runs setCompartmentsFixed() against a live headless cytoscape instance. It reads nothing from
// the service's injected dependencies, so it is called off the prototype rather than building
// the service and the dialog/data services it needs.
import * as cytoscapeModule from 'cytoscape';
import { Core } from 'cytoscape';

import { PathwayDiagramUtilService } from './pathway-diagram-utils';

// allowSyntheticDefaultImports is off (see tsconfig.json), so reach the callable default export
// by hand; the bundled ESM build puts it on `default`.
const cytoscape: typeof cytoscapeModule = (cytoscapeModule as any).default ?? cytoscapeModule;

describe('PathwayDiagramUtilService.setCompartmentsFixed', () => {
  let cy: Core;

  const setFixed = (fixed: boolean) =>
    PathwayDiagramUtilService.prototype.setCompartmentsFixed.call({}, { cy } as any, fixed);

  beforeEach(() => {
    cy = cytoscape({
      headless: true,
      elements: [
        { data: { id: 'c1-outer' }, classes: ['Compartment', 'outer'] },
        { data: { id: 'c1-inner' }, classes: ['Compartment', 'inner'] },
        { data: { id: 'c1-outer-label', compartmentId: 'c1-outer' }, classes: ['Compartment', 'label'] },
        { data: { id: 'p1' }, classes: ['PhysicalEntity', 'Protein'] },
        { data: { id: 'c1-inner_resize_node_nw', compartment: 'c1-inner' }, classes: ['Modification', 'resizing'] },
        { data: { id: 'p1_resize_node_nw', compartment: 'p1' }, classes: ['Modification', 'resizing'] }
      ]
    });
    // As PathwayDiagramUtilService.enableEditing() leaves them.
    cy.nodes().grabify().unpanify();
  });

  afterEach(() => cy.destroy());

  it('stops every compartment layer and label from being dragged', () => {
    setFixed(true);

    expect(cy.nodes('.Compartment').every((node: any) => !node.grabbable())).toBeTrue();
  });

  it('lets a drag on a fixed compartment pan the view, as the background does', () => {
    setFixed(true);

    expect(cy.nodes('.Compartment').every((node: any) => node.pannable())).toBeTrue();
  });

  it('leaves other nodes draggable', () => {
    setFixed(true);

    expect(cy.getElementById('p1').grabbable()).toBeTrue();
  });

  it('does not lock nodes, which would be written into the uploaded JSON', () => {
    setFixed(true);

    expect(cy.nodes().every((node: any) => !node.locked())).toBeTrue();
  });

  it('removes resize widgets of compartments only', () => {
    setFixed(true);

    expect(cy.getElementById('c1-inner_resize_node_nw').length).toBe(0);
    expect(cy.getElementById('p1_resize_node_nw').length).toBe(1);
  });

  it('makes compartments draggable again when unfixed', () => {
    setFixed(true);
    setFixed(false);

    const compartments = cy.nodes('.Compartment');
    expect(compartments.every((node: any) => node.grabbable() && !node.pannable())).toBeTrue();
  });
});

describe('PathwayDiagramUtilService.snapModificationToParentBoundary', () => {
  let cy: Core;

  // The helpers it calls live on the prototype, so use that as `this`.
  const snap = (modNode: any) =>
    PathwayDiagramUtilService.prototype.snapModificationToParentBoundary.call(
      PathwayDiagramUtilService.prototype, modNode, cy);

  // p1 spans x: 50..150, y: 80..120
  beforeEach(() => {
    cy = cytoscape({
      headless: true,
      // Keep the given positions; the default layout would reset them all to the origin.
      layout: { name: 'preset' },
      elements: [
        { data: { id: 'p1', reactomeId: 1, width: 100, height: 40 }, position: { x: 100, y: 100 }, classes: ['PhysicalEntity', 'Protein'] },
        // A second drawing of the same entity, elsewhere in the diagram
        { data: { id: 'p2', reactomeId: 1, width: 100, height: 40 }, position: { x: 500, y: 500 }, classes: ['PhysicalEntity', 'Protein'] },
        { data: { id: 'm1', nodeId: 'p1', nodeReactomeId: 1, width: 20, height: 20 }, position: { x: 100, y: 80 }, classes: ['Modification'] }
      ]
    });
  });

  afterEach(() => cy.destroy());

  const moveAndSnap = (pos: { x: number, y: number }) => {
    const mod = cy.getElementById('m1');
    mod.position(pos);
    snap(mod);
    return mod.position();
  };

  it('projects a point outside the node onto the nearest edge', () => {
    expect(moveAndSnap({ x: 120, y: 20 })).toEqual({ x: 120, y: 80 });
    expect(moveAndSnap({ x: 200, y: 110 })).toEqual({ x: 150, y: 110 });
  });

  it('projects a point beyond a corner onto that corner', () => {
    expect(moveAndSnap({ x: 0, y: 0 })).toEqual({ x: 50, y: 80 });
  });

  it('projects a point inside the node onto the nearest edge', () => {
    expect(moveAndSnap({ x: 60, y: 100 })).toEqual({ x: 50, y: 100 });
    expect(moveAndSnap({ x: 100, y: 115 })).toEqual({ x: 100, y: 120 });
  });

  it('uses the drawn occurrence named by nodeId, not another with the same reactomeId', () => {
    expect(moveAndSnap({ x: 480, y: 480 })).toEqual({ x: 150, y: 120 });
  });
});
