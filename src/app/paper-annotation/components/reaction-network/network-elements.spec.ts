import { Network } from '../../models/llm-api.models';
import { cytoscape, neighbours, toElements } from './network-elements';

const NET: Network = {
  nodes: [
    { id: 'e:ub', type: 'entity', key: 'ub', kind: 'ewas', label: 'UB', compartment: 'cytosol', unresolved: ['uniprot'], openIssues: 1 },
    { id: 'e:atp', type: 'entity', key: 'atp', kind: 'simple', label: 'ATP', unresolved: [], openIssues: 0 },
    { id: 'e:pink1', type: 'entity', key: 'pink1', kind: 'ewas', label: 'PINK1', unresolved: [], openIssues: 0 },
    { id: 'r:r0', type: 'reaction', key: 'r0', label: 'PINK1 phosphorylates Ub', reactionType: 'transition', openIssues: 2, existingMatch: 'same' },
    { id: 'r:r1', type: 'reaction', key: 'r1', label: 'Next', openIssues: 0, existingMatch: null },
  ],
  edges: [
    { id: 'input:0', type: 'input', source: 'e:ub', target: 'r:r0' },
    { id: 'input:1', type: 'input', source: 'e:atp', target: 'r:r0' },
    { id: 'catalyst:2', type: 'catalyst', source: 'e:pink1', target: 'r:r0', label: 'kinase activity' },
    { id: 'precedes:3', type: 'precedes', source: 'r:r0', target: 'r:r1' },
  ],
};

describe('network elements', () => {
  it('make a node per entity and reaction and an edge per role, with classes for styling', () => {
    const cy = cytoscape({ headless: true, elements: toElements(NET) });
    expect(cy.nodes().length).toBe(5);
    expect(cy.edges().length).toBe(4);
    expect(cy.getElementById('e:ub').hasClass('ewas')).toBeTrue();
    expect(cy.getElementById('r:r0').hasClass('reaction') && cy.getElementById('r:r0').hasClass('match-same')).toBeTrue();
    expect(cy.getElementById('catalyst:2').hasClass('catalyst')).toBeTrue();
  });

  it('draw the compartment under the entity name, and flag unresolved entities and reactions with issues', () => {
    const cy = cytoscape({ headless: true, elements: toElements(NET) });
    expect(cy.getElementById('e:ub').data('label')).toBe('UB\n[cytosol]');
    expect(cy.getElementById('e:ub').data('unresolved')).toBeTrue();
    expect(cy.getElementById('e:atp').data('unresolved')).toBeFalse();
    expect(cy.getElementById('r:r0').data('hasIssues')).toBeTrue();
    expect(cy.getElementById('r:r1').data('hasIssues')).toBeFalse();
  });

  it('label only the edges that carry a name', () => {
    const cy = cytoscape({ headless: true, elements: toElements(NET) });
    expect(cy.getElementById('catalyst:2').data('label')).toBe('kinase activity');
    expect(cy.getElementById('input:0').data('label')).toBe('');
  });

  it('find the reactions of an entity and the entities of a reaction, ignoring reaction order', () => {
    expect([...neighbours(NET, 'e:ub')].sort()).toEqual(['e:ub', 'r:r0']);
    expect([...neighbours(NET, 'r:r0')].sort()).toEqual(['e:atp', 'e:pink1', 'e:ub', 'r:r0']);   // not r:r1
  });
});
