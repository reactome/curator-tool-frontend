/**
 * Aliases: an entity or sub-pathway drawn more than once in one diagram, ported from the desktop curator tool's
 * "shortcuts" (Node.generateShortcut(), GraphEditorTransferHandler.importDataAsAlias() and
 * InstanceZoomablePathwayEditor.handleDetachAttachInDrawingMode()). An alias is just another node with the same
 * reactomeId; the server tells them apart by node id (see CytoscapJSToRenderableDiagramConverter in curator-tool-ws).
 */

import { Core, Position } from 'cytoscape';
import { EDGE_POINT_CLASS, LABEL_CLASS } from 'src/app/core/models/reactome-instance.model';

/**
 * Whether a node may have aliases: entities and sub-pathways may, as Renderable.isTransferrable() allows in the
 * desktop tool. Compartments, reactions and flow lines may not, nor anything drawn as part of another node.
 */
export function isAliasable(node: any): boolean {
    if (!node || typeof node.isNode !== 'function' || !node.isNode())
        return false;
    if (!node.hasClass('PhysicalEntity') && !node.hasClass('Pathway'))
        return false;
    return !['Modification', 'Compartment', 'reaction', 'resizing', EDGE_POINT_CLASS, LABEL_CLASS].some(cls => node.hasClass(cls));
}

/**
 * The id for a new node: the preferred id (usually the dbId) if it is free, otherwise the next integer not in
 * use. The server parses node ids as integers, so a suffixed id won't do.
 */
export function getFreeNodeId(preferred: number | string, cy: Core): string {
    if (cy.getElementById(preferred + '').empty())
        return preferred + '';
    let maxId = 0;
    cy.elements().forEach(elm => {
        const id = Number(elm.id());
        if (Number.isInteger(id) && id > maxId)
            maxId = id;
    });
    return (maxId + 1) + '';
}

/**
 * The modification nodes drawn on a node. A modification names its parent node by id (nodeId); older ones only
 * by the parent's reactomeId, which can't tell aliases apart.
 */
export function getModificationNodes(node: any, cy: Core): any {
    return cy.nodes('.Modification').filter((mod: any) => {
        const nodeId = mod.data('nodeId');
        if (nodeId !== undefined && nodeId !== null)
            return String(nodeId) === node.id();
        return mod.data('nodeReactomeId') === node.data('reactomeId');
    });
}

/**
 * Add an alias of a node at the passed position, with copies of its modifications. Its links stay on the
 * original; move them with moveLinkToAlias().
 */
export function createAlias(node: any, position: Position, cy: Core): any {
    const data = JSON.parse(JSON.stringify(node.data()));
    data.id = getFreeNodeId(node.data('reactomeId'), cy);
    const alias = cy.add({
        group: 'nodes',
        data: data,
        position: { x: position.x, y: position.y },
        classes: node.classes()
    })[0];
    const dx = position.x - node.position().x;
    const dy = position.y - node.position().y;
    getModificationNodes(node, cy).forEach((mod: any) => {
        const modData = JSON.parse(JSON.stringify(mod.data()));
        modData.id = getFreeElementId(`mod_${alias.id()}_${mod.data('reactomeId')}`, cy);
        modData.nodeId = alias.id();
        cy.add({
            group: 'nodes',
            data: modData,
            position: { x: mod.position().x + dx, y: mod.position().y + dy },
            classes: mod.classes()
        });
    });
    return alias;
}

/**
 * The node at the end of a link (a reaction's or flow line's segment) that an alias of the passed node could
 * take over, if any.
 */
export function getAliasedEnd(edge: any, alias: any): 'source' | 'target' | undefined {
    for (const end of ['source', 'target'] as const) {
        const node = end === 'source' ? edge.source() : edge.target();
        if (node.id() !== alias.id() && isAliasable(node) && node.data('reactomeId') === alias.data('reactomeId'))
            return end;
    }
    return undefined;
}

/** Whether either end of a link is an entity or sub-pathway, i.e. one that could be moved to an alias. */
export function hasAliasableEnd(edge: any): boolean {
    return !!edge && typeof edge.isEdge === 'function' && edge.isEdge() &&
        (isAliasable(edge.source()) || isAliasable(edge.target()));
}

/**
 * Move a link from a node to one of its aliases. Returns the new edge, or undefined if the alias is not an alias
 * of either end: a link may only be moved to an alias of the node it is linked to.
 */
export function moveLinkToAlias(edge: any, alias: any, cy: Core): any {
    const end = getAliasedEnd(edge, alias);
    if (!end)
        return undefined;
    const oldNodeId = (end === 'source' ? edge.source() : edge.target()).id();
    const data = JSON.parse(JSON.stringify(edge.data()));
    data[end] = alias.id();
    // Edge ids are made as source id + type + target id, so keep that form and a later edge from the original
    // node can't clash with this one.
    let id: string = data.id;
    if (end === 'source' && id.startsWith(oldNodeId))
        id = alias.id() + id.substring(oldNodeId.length);
    else if (end === 'target' && id.endsWith(oldNodeId))
        id = id.substring(0, id.length - oldNodeId.length) + alias.id();
    const classes = edge.classes();
    cy.remove(edge);
    data.id = getFreeElementId(id, cy);
    return cy.add({ group: 'edges', data: data, classes: classes })[0];
}

function getFreeElementId(preferred: string, cy: Core): string {
    let id = preferred;
    for (let i = 1; !cy.getElementById(id).empty(); i++)
        id = `${preferred}_${i}`;
    return id;
}
