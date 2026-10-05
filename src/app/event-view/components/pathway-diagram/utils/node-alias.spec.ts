import * as cytoscapeModule from 'cytoscape';
import { Core } from 'cytoscape';

import { EDGE_POINT_CLASS } from 'src/app/core/models/reactome-instance.model';
import { createAlias, getModificationNodes, hasAliasableEnd, isAliasable, moveLinkToAlias } from './node-alias';

// allowSyntheticDefaultImports is off (see tsconfig.json), so reach the callable default export by hand.
const cytoscape: typeof cytoscapeModule = (cytoscapeModule as any).default ?? cytoscapeModule;

describe('node-alias', () => {
  let cy: Core;

  beforeEach(() => cy = cytoscape({
    headless: true,
    // The default null layout would move every node to (0, 0)
    layout: { name: 'preset' },
    elements: [
      { data: { id: '5205652', reactomeId: 5205652, displayName: 'PINK1' }, position: { x: 100, y: 100 }, classes: ['PhysicalEntity', 'Protein'] },
      { data: { id: 'mod_5205652_9', reactomeId: 9, nodeReactomeId: 5205652, nodeId: '5205652' }, position: { x: 130, y: 100 }, classes: ['Modification'] },
      { data: { id: '29358', reactomeId: 29358, displayName: 'ATP' }, position: { x: 0, y: 0 }, classes: ['PhysicalEntity', 'Chemical'] },
      { data: { id: '68875', reactomeId: 68875 }, position: { x: 300, y: 0 }, classes: ['Pathway', 'SUB'] },
      { data: { id: 'reaction_1', reactionId: 'reaction_1', reactomeId: 1 }, position: { x: 200, y: 100 }, classes: ['reaction', 'transition'] },
      { data: { id: '1_input', reactomeId: 1 }, position: { x: 150, y: 100 }, classes: ['reaction', EDGE_POINT_CLASS] },
      { data: { id: '9-outer', reactomeId: 70101 }, position: { x: 0, y: 0 }, classes: ['Compartment', 'outer'] },
      { data: { id: '5205652-->1_input', source: '5205652', target: '1_input', reactomeId: 1 }, classes: ['consumption', 'incoming'] },
      { data: { id: '1_input-->reaction_1', source: '1_input', target: 'reaction_1', reactomeId: 1 }, classes: ['reaction', 'input'] },
    ]
  }));
  afterEach(() => cy.destroy());

  it('allow aliases of entities and sub-pathways only', () => {
    expect(isAliasable(cy.getElementById('5205652'))).toBeTrue();
    expect(isAliasable(cy.getElementById('68875'))).toBeTrue();
    expect(isAliasable(cy.getElementById('reaction_1'))).toBeFalse();
    expect(isAliasable(cy.getElementById('1_input'))).toBeFalse();
    expect(isAliasable(cy.getElementById('9-outer'))).toBeFalse();
    expect(isAliasable(cy.getElementById('mod_5205652_9'))).toBeFalse();
    expect(isAliasable(cy.getElementById('1_input-->reaction_1'))).toBeFalse();
  });

  it('paste an alias with the same instance and a new integer id, without its links', () => {
    const alias = createAlias(cy.getElementById('5205652'), { x: 400, y: 400 }, cy);
    expect(alias.id()).toBe('5205653');
    expect(alias.data('reactomeId')).toBe(5205652);
    expect(alias.data('displayName')).toBe('PINK1');
    expect(alias.hasClass('Protein')).toBeTrue();
    expect(alias.position()).toEqual({ x: 400, y: 400 });
    expect(alias.connectedEdges().length).toBe(0);
  });

  it('give an alias its own copies of the modifications, which follow the alias only', () => {
    const original = cy.getElementById('5205652');
    const alias = createAlias(original, { x: 400, y: 400 }, cy);
    const mods = getModificationNodes(alias, cy);
    expect(mods.length).toBe(1);
    expect(mods[0].data('nodeId')).toBe(alias.id());
    expect(mods[0].data('reactomeId')).toBe(9);
    expect(mods[0].position()).toEqual({ x: 430, y: 400 });
    expect(getModificationNodes(original, cy).map((m: any) => m.id())).toEqual(['mod_5205652_9']);
  });

  it('move a link from the original to its alias', () => {
    const alias = createAlias(cy.getElementById('5205652'), { x: 400, y: 400 }, cy);
    const link = cy.getElementById('5205652-->1_input');
    expect(hasAliasableEnd(link)).toBeTrue();
    const moved = moveLinkToAlias(link, alias, cy);
    expect(moved.id()).toBe('5205653-->1_input');
    expect(moved.source().id()).toBe(alias.id());
    expect(moved.target().id()).toBe('1_input');
    expect(moved.data('reactomeId')).toBe(1);
    expect(moved.hasClass('consumption') && moved.hasClass('incoming')).toBeTrue();
    expect(cy.getElementById('5205652').connectedEdges().length).toBe(0);
  });

  it('refuse to move a link to a node of another instance', () => {
    const link = cy.getElementById('5205652-->1_input');
    expect(moveLinkToAlias(link, cy.getElementById('29358'), cy)).toBeUndefined();
    expect(link.removed()).toBeFalse();
  });

  it('find no aliasable end on a link inside a reaction', () => {
    expect(hasAliasableEnd(cy.getElementById('1_input-->reaction_1'))).toBeFalse();
  });
});
