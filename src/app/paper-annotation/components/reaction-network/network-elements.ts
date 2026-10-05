import * as cytoscapeModule from 'cytoscape';
import { ElementDefinition, StylesheetStyle } from 'cytoscape';
import { Network, NetworkEdgeType } from '../../models/llm-api.models';

// allowSyntheticDefaultImports is off (see tsconfig.json), so reach the callable default export by hand.
export const cytoscape: typeof cytoscapeModule = (cytoscapeModule as any).default ?? cytoscapeModule;

/** Edge types that say how an entity takes part in a reaction, as the legend lists them. */
export const EDGE_LEGEND: { type: NetworkEdgeType; label: string }[] = [
  { type: 'input', label: 'input / output' },
  { type: 'catalyst', label: 'catalyst' },
  { type: 'positive', label: 'positive regulator' },
  { type: 'negative', label: 'negative regulator' },
  { type: 'requirement', label: 'requirement' },
  { type: 'component', label: 'component / member' },
  { type: 'precedes', label: 'precedes' },
];

/** Cytoscape elements for a network. Node data keeps the server's fields; `label` is what is drawn. */
export function toElements(net: Network): ElementDefinition[] {
  const nodes: ElementDefinition[] = net.nodes.map(n => ({
    group: 'nodes',
    data: {
      ...n,
      label: n.type === 'entity' && n.compartment ? `${n.label}\n[${n.compartment}]` : n.label,
      unresolved: n.type === 'entity' && (n.unresolved?.length ?? 0) > 0,
      hasIssues: n.openIssues > 0,
    },
    classes: [n.type, n.kind ?? '', n.existingMatch ? 'match-' + n.existingMatch : ''].filter(Boolean).join(' '),
  }));
  const edges: ElementDefinition[] = net.edges.map(e => ({
    group: 'edges',
    data: { ...e, label: e.type === 'catalyst' || e.type === 'positive' || e.type === 'negative' ? e.label ?? '' : '' },
    classes: e.type,
  }));
  return [...nodes, ...edges];
}

/** Ids of the reactions an entity takes part in (any role), or of the entities a reaction involves. */
export function neighbours(net: Network, id: string): Set<string> {
  const out = new Set<string>([id]);
  net.edges.forEach(e => {
    if (e.type === 'precedes') return;
    if (e.source === id) out.add(e.target);
    if (e.target === id) out.add(e.source);
  });
  return out;
}

export const STYLE: StylesheetStyle[] = [
  { selector: 'node', style: {
      label: 'data(label)', 'font-size': 10, 'text-wrap': 'wrap', 'text-max-width': '110px',
      'text-valign': 'center', 'text-halign': 'center', color: '#222', 'border-width': 1.5, 'border-color': '#90a4ae',
      'background-color': '#fff', width: 'label', height: 'label', padding: '8px', shape: 'round-rectangle' } as any },  // typings predate `padding`
  { selector: 'node.ewas', style: { 'background-color': '#e3f2fd', 'border-color': '#1976d2', shape: 'ellipse' } },
  { selector: 'node.simple', style: { 'background-color': '#fff3e0', 'border-color': '#ef6c00', shape: 'ellipse' } },
  { selector: 'node.complex', style: { 'background-color': '#ede7f6', 'border-color': '#5e35b1', shape: 'round-rectangle' } },
  { selector: 'node.set', style: { 'background-color': '#e8f5e9', 'border-color': '#2e7d32', shape: 'barrel' } },
  { selector: 'node.reaction', style: {
      'background-color': '#eceff1', 'border-color': '#455a64', shape: 'rectangle', 'font-size': 9,
      'text-max-width': '130px', 'font-weight': 'bold' } },
  { selector: 'node[?unresolved]', style: { 'border-style': 'dashed', 'border-color': '#c62828' } },
  { selector: 'node.reaction[?hasIssues]', style: { 'border-color': '#ef6c00', 'border-width': 3 } },
  { selector: 'node.match-same', style: { 'border-style': 'double', 'border-width': 4, 'border-color': '#b26a00' } },
  { selector: 'node.match-similar', style: { 'border-style': 'dotted', 'border-width': 3, 'border-color': '#b26a00' } },
  { selector: 'edge', style: {
      width: 1.5, 'curve-style': 'bezier', 'line-color': '#78909c', 'target-arrow-color': '#78909c',
      'target-arrow-shape': 'triangle', 'arrow-scale': 1, label: 'data(label)', 'font-size': 8,
      'text-background-color': '#fff', 'text-background-opacity': .8, 'text-rotation': 'autorotate' } },
  { selector: 'edge.catalyst', style: { 'line-color': '#2e7d32', 'target-arrow-color': '#2e7d32', 'target-arrow-shape': 'circle' } },
  { selector: 'edge.positive', style: { 'line-color': '#388e3c', 'target-arrow-color': '#388e3c', 'target-arrow-shape': 'triangle-tee' } },
  { selector: 'edge.negative', style: { 'line-color': '#c62828', 'target-arrow-color': '#c62828', 'target-arrow-shape': 'tee' } },
  { selector: 'edge.requirement', style: { 'line-color': '#6a1b9a', 'target-arrow-color': '#6a1b9a', 'target-arrow-shape': 'diamond' } },
  { selector: 'edge.component, edge.member', style: {
      'line-style': 'dashed', width: 1, 'line-color': '#b0bec5', 'target-arrow-color': '#b0bec5', 'target-arrow-shape': 'none' } },
  { selector: 'edge.precedes', style: { 'line-style': 'dotted', 'line-color': '#9e9e9e', 'target-arrow-color': '#9e9e9e' } },
  { selector: '.faded', style: { opacity: .15 } },
  { selector: 'node:selected, node.picked', style: { 'overlay-color': '#1976d2', 'overlay-opacity': .2, 'overlay-padding': 6 } },
];
