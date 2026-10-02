import * as cytoscapeModule from 'cytoscape';
import { Core } from 'cytoscape';

import { assignCompartmentZOrder, COMPARTMENT_LABEL_Z_INDEX, getCompartmentLayerKey, getCompartmentZ } from './compartment-z-order';

// allowSyntheticDefaultImports is off (see tsconfig.json), so reach the callable default export
// by hand; the bundled ESM build puts it on `default`.
const cytoscape: typeof cytoscapeModule = (cytoscapeModule as any).default ?? cytoscapeModule;

/** A two-layer compartment, centered at (x, y). */
function compartment(id: string, x: number, y: number, size: number) {
  return [
    { data: { id: `${id}-outer`, width: size + 20, height: size + 20 }, position: { x, y }, classes: ['Compartment', 'outer'] },
    { data: { id: `${id}-inner`, width: size, height: size }, position: { x, y }, classes: ['Compartment', 'inner'] }
  ];
}

describe('compartment-z-order', () => {
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
          // extracellular region > plasma membrane > cytosol > nucleoplasm, by the drawing alone.
          // The innermost compartments come first, so that drawing order alone would put them underneath.
          ...compartment('nucleoplasm', 0, 0, 200),
          ...compartment('cytosol', 0, 0, 800),
          // Membranes are drawn as a single layer
          { data: { id: 'membrane', width: 900, height: 900 }, position: { x: 0, y: 0 }, classes: ['Compartment', 'outer'] },
          ...compartment('extracellular', 0, 0, 1000),
          // Inside cytosol, next to nucleoplasm
          ...compartment('mitochondrion', 300, 300, 100),
          // Inside extracellular region, straddling the edge of the membrane
          ...compartment('overlapping', 450, 0, 40),
          // Outside everything
          ...compartment('outside', 5000, 5000, 100),
          { data: { id: 'cytosol-outer-label', compartmentId: 'cytosol-outer', width: 50, height: 20 }, position: { x: 0, y: 0 }, classes: ['Compartment', 'outer', 'label'] },
          { data: { id: 'p1', reactomeId: 1, width: 50, height: 20 }, position: { x: 0, y: 0 }, classes: ['PhysicalEntity', 'Protein'] }
        ]
      });
    });

    afterEach(() => cy.destroy());

    it('puts a compartment one level above the deepest compartment it lies inside', () => {
      assignCompartmentZOrder(cy);

      expect(z('extracellular-outer')).toBe(getCompartmentZ(0, false));
      expect(z('membrane')).toBe(getCompartmentZ(1, false));
      expect(z('cytosol-outer')).toBe(getCompartmentZ(2, false));
      expect(z('nucleoplasm-outer')).toBe(getCompartmentZ(3, false));
      expect(z('mitochondrion-outer')).toBe(getCompartmentZ(3, false));
    });

    it('only nests a compartment that lies wholly inside another', () => {
      assignCompartmentZOrder(cy);

      expect(z('overlapping-outer')).toBe(getCompartmentZ(1, false));
      expect(z('outside-outer')).toBe(getCompartmentZ(0, false));
    });

    it('puts each inner layer above its outer layer but below the next level up', () => {
      assignCompartmentZOrder(cy);

      expect(z('cytosol-inner')).toBe(getCompartmentZ(2, true));
      expect(z('cytosol-inner')).toBeGreaterThan(z('cytosol-outer'));
      expect(z('cytosol-inner')).toBeLessThan(z('nucleoplasm-outer'));
    });

    it('applies the z score as the z-index', () => {
      assignCompartmentZOrder(cy);

      cy.nodes('.Compartment').not('.label').forEach(node => {
        expect(node.numericStyle('z-index')).toBe(node.data('z'));
      });
    });

    it('follows a compartment that has been moved', () => {
      assignCompartmentZOrder(cy);
      cy.getElementById('mitochondrion-outer').position({ x: -5000, y: -5000 });
      cy.getElementById('mitochondrion-inner').position({ x: -5000, y: -5000 });

      assignCompartmentZOrder(cy);

      expect(z('mitochondrion-outer')).toBe(getCompartmentZ(0, false));
      expect(z('mitochondrion-inner')).toBe(getCompartmentZ(0, true));
    });

    it('keeps label nodes above every compartment and gives them no z score', () => {
      assignCompartmentZOrder(cy);

      expect(zIndex('cytosol-outer-label')).toBe(COMPARTMENT_LABEL_Z_INDEX);
      expect(z('cytosol-outer-label')).toBeUndefined();
      cy.nodes('.Compartment').not('.label').forEach(node => {
        expect(node.data('z')).toBeLessThan(COMPARTMENT_LABEL_Z_INDEX);
      });
    });

    it('leaves non-compartment nodes alone', () => {
      assignCompartmentZOrder(cy);

      expect(z('p1')).toBeUndefined();
    });
  });
});
