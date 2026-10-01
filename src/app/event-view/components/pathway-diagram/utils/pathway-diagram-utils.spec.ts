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
