import * as cytoscapeModule from 'cytoscape';
import { Core } from 'cytoscape';
import { DiagramService } from 'ngx-reactome-diagram';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { HyperEdge } from './hyperedge';
import { InstanceConverter, isUnsharedEntity } from './instance-converter';

// allowSyntheticDefaultImports is off (see tsconfig.json), so reach the callable default export by hand.
const cytoscape: typeof cytoscapeModule = (cytoscapeModule as any).default ?? cytoscapeModule;

const ATP: Instance = { dbId: 29358, schemaClassName: 'SimpleEntity', displayName: 'ATP [cytosol]' };
const GLUCOSE: Instance = { dbId: 29406, schemaClassName: 'SimpleEntity', displayName: 'D-glucose [cytosol]' };
const PINK1: Instance = { dbId: 5205652, schemaClassName: 'EntityWithAccessionedSequence', displayName: 'PINK1 [mitochondrial outer membrane]' };

describe('InstanceConverter.createPENode', () => {
  const service = { nodeTypeMap: new Map([['Chemical', ['PhysicalEntity', 'Chemical']], ['Entity', ['PhysicalEntity', 'Entity']]]) } as unknown as DiagramService;
  const converter = new InstanceConverter();
  let cy: Core;
  const reaction = (dbId: number) => new HyperEdge({} as any, cy, dbId);
  const nodesFor = (pe: Instance) => cy.nodes().filter(n => n.data('reactomeId') === pe.dbId);

  beforeEach(() => cy = cytoscape({ headless: true, styleEnabled: true }));
  afterEach(() => cy.destroy());

  it('give a listed cofactor a new node in each reaction that uses it', () => {
    const first = converter.createPENode(ATP, cy, reaction(1), service);
    const second = converter.createPENode(ATP, cy, reaction(2), service);
    expect(second.id()).not.toBe(first.id());
    expect(nodesFor(ATP).length).toBe(2);
  });

  it('share a listed cofactor\'s node within one reaction, so stoichiometry can be counted', () => {
    const r1 = reaction(1);
    const first = converter.createPENode(ATP, cy, r1, service);
    expect(converter.createPENode(ATP, cy, r1, service).id()).toBe(first.id());
    expect(nodesFor(ATP).length).toBe(1);
  });

  it('share one node of a small molecule that is not listed between reactions', () => {
    const first = converter.createPENode(GLUCOSE, cy, reaction(1), service);
    expect(converter.createPENode(GLUCOSE, cy, reaction(2), service).id()).toBe(first.id());
    expect(nodesFor(GLUCOSE).length).toBe(1);
  });

  it('share one node of any other entity between reactions', () => {
    const first = converter.createPENode(PINK1, cy, reaction(1), service);
    expect(converter.createPENode(PINK1, cy, reaction(2), service).id()).toBe(first.id());
    expect(nodesFor(PINK1).length).toBe(1);
  });

  it('give a node its dbId as id, or the next unused integer, as the server parses ids as integers', () => {
    const first = converter.createPENode(ATP, cy, reaction(1), service);
    converter.createPENode(PINK1, cy, reaction(1), service);
    const second = converter.createPENode(ATP, cy, reaction(2), service);
    expect(first.id()).toBe('29358');
    expect(second.id()).toBe('5205653');
  });

  it('make a new node for a listed cofactor whose node in the reaction was removed', () => {
    const r1 = reaction(1);
    const first = converter.createPENode(ATP, cy, r1, service);
    cy.remove(first);
    expect(converter.createPENode(ATP, cy, r1, service).removed()).toBeFalse();
  });
});

describe('isUnsharedEntity', () => {
  const pe = (displayName: string): Instance => ({ dbId: 1, schemaClassName: 'SimpleEntity', displayName });

  it('match a listed name whatever its compartment', () => {
    expect(isUnsharedEntity(pe('H2O [mitochondrial matrix]'))).toBeTrue();
    expect(isUnsharedEntity(pe('H+ [cytosol]'))).toBeTrue();
    expect(isUnsharedEntity(pe('NADH'))).toBeTrue();
  });

  it('match only the whole name', () => {
    expect(isUnsharedEntity(pe('NAD+ [cytosol]'))).toBeFalse();
    expect(isUnsharedEntity(pe('dATP [nucleoplasm]'))).toBeFalse();
    expect(isUnsharedEntity(pe('D-glucose [cytosol]'))).toBeFalse();
  });
});
