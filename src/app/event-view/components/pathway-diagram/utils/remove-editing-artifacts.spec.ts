// Runs removeEditingArtifacts() against a live headless cytoscape instance with a network as it is
// left in the editing mode, but without any HyperEdge tracking it (e.g. restored from an undo snapshot
// or a backup). Such a network was uploaded for WNT (3858498) on 2026-11-23.
import * as cytoscapeModule from 'cytoscape';
import { Core } from 'cytoscape';

import { PathwayDiagramUtilService } from './pathway-diagram-utils';

const cytoscape: typeof cytoscapeModule = (cytoscapeModule as any).default ?? cytoscapeModule;

describe('PathwayDiagramUtilService.removeEditingArtifacts', () => {
  let cy: Core;
  let service: PathwayDiagramUtilService;

  const pe = (id: string, x: number, y: number) =>
    ({ data: { id, reactomeId: Number(id), displayName: 'P' + id, width: 60, height: 30 }, position: { x, y }, classes: ['PhysicalEntity', 'Protein'] });

  const edge = (source: string, target: string, classes: string[], role: string, stoichiometry?: number) =>
    ({ data: { id: source + '--' + target, source, target, reactomeId: 100, role, ...(stoichiometry ? { stoichiometry } : {}) }, classes });

  beforeEach(() => {
    const converter = {
      getFontStyle: () => '12px Arial',
      measureTextWidth: () => 50,
      measureTextHeight: () => 12
    };
    const instanceUtils = { copyData: (data: any) => JSON.parse(JSON.stringify(data)) };
    service = new PathwayDiagramUtilService(undefined as any, undefined as any, converter as any, instanceUtils as any, undefined as any);
    service.diagramService = {
      edgeTypeMap: new Map<string, string[]>([
        ['INPUT', ['consumption', 'incoming', 'reaction']],
        ['CATALYST', ['catalysis', 'incoming', 'reaction']],
        ['OUTPUT', ['production', 'outgoing', 'reaction']]
      ]),
      edgeTypeToStr: new Map<string, string>([['INPUT', '-'], ['CATALYST', 'o'], ['OUTPUT', '>']])
    } as any;
    const hub = '100:200_200';
    cy = cytoscape({
      headless: true,
      styleEnabled: true,
      // Keep the saved positions: the default grid layout would move every node
      layout: { name: 'preset' },
      // Node sizes as the diagram library sets them; edge endpoints are computed from them
      style: [
        { selector: 'node', style: { width: 10, height: 10 } },
        { selector: 'node[width]', style: { width: 'data(width)', height: 'data(height)' } }
      ] as any,
      elements: [
        { data: { id: '70101-outer', displayName: '', textX: -100, textY: -50, width: 1000, height: 800 }, position: { x: 600, y: 500 }, classes: ['Compartment', 'outer'] },
        { data: { id: '70101-outer-label', compartmentId: '70101-outer', displayName: 'cytosol', width: 50, height: 12 }, position: { x: 225, y: 208 }, classes: ['Compartment', 'outer', 'label'] },
        pe('1', 100, 100),
        pe('2', 100, 300),
        pe('3', 500, 200),
        { data: { id: 'reaction_100', reactionId: 'reaction_100', reactomeId: 100 }, position: { x: 300, y: 200 }, classes: ['reaction', 'transition'] },
        { data: { id: hub, reactomeId: 100 }, position: { x: 200, y: 200 }, classes: ['input', 'edge_point', 'reaction', 'input_hub'] },
        edge('1', hub, ['consumption', 'incoming', 'reaction'], 'input', 2),
        edge('2', hub, ['consumption', 'incoming', 'reaction'], 'input'),
        edge(hub, 'reaction_100', ['reaction', 'input'], 'input'),
        edge('reaction_100', '3', ['production', 'outgoing', 'reaction'], 'output')
      ]
    });
  });

  afterEach(() => cy.destroy());

  it('folds the compartment label back into its compartment', () => {
    service.removeEditingArtifacts({ cy } as any);

    expect(cy.getElementById('70101-outer-label').empty()).toBeTrue();
    expect(cy.getElementById('70101-outer').data('displayName')).toBe('cytosol');
  });

  it('collapses edges through an input hub into edges from the inputs to the reaction', () => {
    service.removeEditingArtifacts({ cy } as any);

    expect(cy.nodes('.edge_point').empty()).toBeTrue();
    const inputs = cy.edges('.consumption').filter((e: any) => e.data('target') === 'reaction_100');
    expect(inputs.map((e: any) => e.data('source')).sort()).toEqual(['1', '2']);
    const fromP1 = inputs.filter((e: any) => e.data('source') === '1')[0];
    expect(fromP1.data('stoichiometry')).toBe(2);
    expect(fromP1.data('curveStyle')).toBe('round-segments');
    // The output edge was not routed through any edge point and is kept as it is
    expect(cy.getElementById('reaction_100--3').nonempty()).toBeTrue();
  });

  it('does nothing to a network without editing artifacts', () => {
    cy.remove(cy.nodes('.edge_point, .label'));
    cy.add([
      { group: 'edges', data: { id: '1-reaction_100', source: '1', target: 'reaction_100', reactomeId: 100 }, classes: ['consumption', 'incoming', 'reaction'] }
    ]);
    const before = cy.elements().jsons();

    service.removeEditingArtifacts({ cy } as any);

    expect(cy.elements().jsons()).toEqual(before);
  });

  // As initDiagram() does when a backup taken in the editing mode is loaded for editing.
  describe('then enableEditing() on a network loaded from an editing-state backup', () => {
    // enableEditing() flags new edges for sub-pathways, which needs no real diagram here
    const diagram = () => ({ cy, flag: () => {} } as any);
    const labels = () => cy.nodes('.label');
    const hubs = () => cy.nodes('.edge_point').filter((node: any) => node.connectedEdges().length > 2);

    beforeEach(() => {
      service.removeEditingArtifacts(diagram());
      service.enableEditing(diagram());
    });

    afterEach(() => service.id2hyperEdge.clear());

    it('has exactly one label node per compartment, carrying the compartment name', () => {
      expect(labels().length).toBe(1);
      expect(labels()[0].id()).toBe('70101-outer-label');
      expect(labels()[0].data('displayName')).toBe('cytosol');
    });

    it('has exactly one input hub, at the position saved in the backup', () => {
      expect(hubs().length).toBe(1);
      expect(hubs()[0].position()).toEqual({ x: 200, y: 200 });
    });

    it('keeps the inputs and output attached to the reaction', () => {
      const ends = cy.nodes('.PhysicalEntity').map((node: any) => node.id() + ':' + node.connectedEdges().length);
      expect(ends.sort()).toEqual(['1:1', '2:1', '3:1']);
    });

    it('gives the same network after a second disable/enable cycle', () => {
      const snapshot = () => cy.elements().jsons().map((e: any) => e.data.id).sort();
      const before = snapshot();
      service.disableEditing(diagram());
      service.removeEditingArtifacts(diagram());
      service.enableEditing(diagram());
      expect(snapshot()).toEqual(before);
    });
  });
});
