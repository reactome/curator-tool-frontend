import * as cytoscapeModule from 'cytoscape';
import { Core } from 'cytoscape';

import { CompartmentTreeNode } from 'src/app/core/models/reactome-instance.model';
import { assignCompartmentZOrder, COMPARTMENT_LABEL_Z_INDEX, getCompartmentDepths, getCompartmentLayerKey, getCompartmentZ } from './compartment-z-order';

// allowSyntheticDefaultImports is off (see tsconfig.json), so reach the callable default export
// by hand; the bundled ESM build puts it on `default`.
const cytoscape: typeof cytoscapeModule = (cytoscapeModule as any).default ?? cytoscapeModule;

function treeNode(dbId: number, depth: number, children: CompartmentTreeNode[] = []): CompartmentTreeNode {
  return {
    dbId, depth, children,
    displayName: `c${dbId}`, schemaClassName: 'Compartment',
    siblings: [], componentOf: [], components: []
  };
}

// extracellular region (984) > plasma membrane (876) > cytosol (70101) > nucleus (7660),
// with cytosol also directly under extracellular region, i.e. reached at two depths.
const TREE = treeNode(984, 0, [
  treeNode(876, 1, [treeNode(70101, 2, [treeNode(7660, 3)])]),
  treeNode(70101, 1, [treeNode(7660, 2)])
]);

/** A two-layer compartment, centered at (x, y). */
function compartment(reactomeId: number, x: number, y: number, size: number) {
  return [
    { data: { id: `${reactomeId}-outer`, reactomeId, width: size + 20, height: size + 20 }, position: { x, y }, classes: ['Compartment', 'outer'] },
    { data: { id: `${reactomeId}-inner`, reactomeId, width: size, height: size }, position: { x, y }, classes: ['Compartment', 'inner'] }
  ];
}

describe('compartment-z-order', () => {
  describe('getCompartmentDepths', () => {
    it('keeps the largest depth of a compartment reached through several parents', () => {
      const depths = getCompartmentDepths(TREE);

      expect(depths.get(984)).toBe(0);
      expect(depths.get(876)).toBe(1);
      expect(depths.get(70101)).toBe(2);
      expect(depths.get(7660)).toBe(3);
    });
  });

  describe('getCompartmentLayerKey', () => {
    it('gives both layers of a compartment the same key', () => {
      const cy = cytoscape({ headless: true, elements: [{ data: { id: '12-outer' } }, { data: { id: '12-inner' } }, { data: { id: '876' } }] });

      expect(getCompartmentLayerKey(cy.getElementById('12-outer'))).toBe('12');
      expect(getCompartmentLayerKey(cy.getElementById('12-inner'))).toBe('12');
      expect(getCompartmentLayerKey(cy.getElementById('876'))).toBe('876');
      cy.destroy();
    });
  });

  describe('assignCompartmentZOrder', () => {
    let cy: Core;
    const z = (id: string) => cy.getElementById(id).data('z');
    const zIndex = (id: string) => cy.getElementById(id).numericStyle('z-index');

    beforeEach(() => {
      cy = cytoscape({
        headless: true,
        styleEnabled: true,
        // The default null layout would move every node to (0, 0)
        layout: { name: 'preset' },
        style: [{ selector: 'node', style: { width: 'data(width)', height: 'data(height)' } }],
        elements: [
          ...compartment(984, 0, 0, 1000),
          // Membranes are drawn as a single layer
          { data: { id: '876', reactomeId: 876, width: 900, height: 900 }, position: { x: 0, y: 0 }, classes: ['Compartment', 'outer'] },
          ...compartment(70101, 0, 0, 800),
          ...compartment(7660, 0, 0, 200),
          // Not in the tree, but drawn inside cytosol
          ...compartment(18730, 300, 300, 100),
          // Not in the tree, and outside everything
          ...compartment(1222638, 5000, 5000, 100),
          { data: { id: '70101-outer-label', compartmentId: '70101-outer', width: 50, height: 20 }, position: { x: 0, y: 0 }, classes: ['Compartment', 'outer', 'label'] },
          { data: { id: 'p1', reactomeId: 1, width: 50, height: 20 }, position: { x: 0, y: 0 }, classes: ['PhysicalEntity', 'Protein'] }
        ]
      });
    });

    afterEach(() => cy.destroy());

    it('gives the most parental compartments the lowest z', () => {
      assignCompartmentZOrder(cy, getCompartmentDepths(TREE));

      expect(z('984-outer')).toBe(getCompartmentZ(0, false));
      expect(z('876')).toBe(getCompartmentZ(1, false));
      expect(z('70101-outer')).toBe(getCompartmentZ(2, false));
      expect(z('7660-outer')).toBe(getCompartmentZ(3, false));
      expect(z('984-outer')).toBeLessThan(z('876'));
      expect(z('876')).toBeLessThan(z('70101-outer'));
      expect(z('70101-outer')).toBeLessThan(z('7660-outer'));
    });

    it('puts each inner layer above its outer layer but below the next level down', () => {
      assignCompartmentZOrder(cy, getCompartmentDepths(TREE));

      expect(z('70101-inner')).toBeGreaterThan(z('70101-outer'));
      expect(z('70101-inner')).toBeLessThan(z('7660-outer'));
    });

    it('applies the z score as the z-index', () => {
      assignCompartmentZOrder(cy, getCompartmentDepths(TREE));

      cy.nodes('.Compartment').not('.label').forEach(node => {
        expect(node.numericStyle('z-index')).toBe(node.data('z'));
      });
    });

    it('places a compartment that is not in the tree below the deepest one drawn around it', () => {
      assignCompartmentZOrder(cy, getCompartmentDepths(TREE));

      expect(z('18730-outer')).toBe(getCompartmentZ(3, false));
      expect(z('18730-inner')).toBe(getCompartmentZ(3, true));
      expect(z('1222638-outer')).toBe(getCompartmentZ(0, false));
    });

    it('falls back to the drawing alone without a tree', () => {
      assignCompartmentZOrder(cy);

      expect(z('984-outer')).toBe(getCompartmentZ(0, false));
      expect(z('876')).toBeGreaterThan(z('984-inner'));
      expect(z('7660-outer')).toBeGreaterThan(z('70101-inner'));
    });

    it('keeps label nodes above every compartment and gives them no z score', () => {
      assignCompartmentZOrder(cy, getCompartmentDepths(TREE));

      expect(zIndex('70101-outer-label')).toBe(COMPARTMENT_LABEL_Z_INDEX);
      expect(z('70101-outer-label')).toBeUndefined();
      cy.nodes('.Compartment').not('.label').forEach(node => {
        expect(node.data('z')).toBeLessThan(COMPARTMENT_LABEL_Z_INDEX);
      });
    });

    describe('for compartments loaded from the diagram JSON, which have no reactomeId', () => {
      beforeEach(() => {
        cy.nodes('.Compartment').forEach(node => { node.removeData('reactomeId'); });
      });

      it('still nests them by the drawing', () => {
        assignCompartmentZOrder(cy);

        expect(z('876')).toBeGreaterThan(z('984-inner'));
        expect(z('70101-outer')).toBeGreaterThan(z('876'));
        expect(z('7660-outer')).toBeGreaterThan(z('70101-inner'));
        expect(z('7660-inner')).toBeGreaterThan(z('7660-outer'));
      });

      it('finds them in the tree through their layer key', () => {
        const layerKey2dbId = new Map([['984', 984], ['876', 876], ['70101', 70101], ['7660', 7660]]);

        assignCompartmentZOrder(cy, getCompartmentDepths(TREE), layerKey2dbId);

        expect(z('984-outer')).toBe(getCompartmentZ(0, false));
        expect(z('876')).toBe(getCompartmentZ(1, false));
        expect(z('70101-inner')).toBe(getCompartmentZ(2, true));
        expect(z('7660-outer')).toBe(getCompartmentZ(3, false));
      });
    });

    it('leaves non-compartment nodes alone', () => {
      assignCompartmentZOrder(cy, getCompartmentDepths(TREE));

      expect(z('p1')).toBeUndefined();
    });
  });
});
