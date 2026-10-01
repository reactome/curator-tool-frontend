/**
 * Stack compartments in the pathway diagram by their place in the compartment hierarchy
 * (getCompartmentTree): the most parental compartments get the lowest z, so a compartment is
 * always drawn - and hit-tested - above the compartments that surround it.
 *
 * The z score is kept on each compartment node as data('z') next to its x/y position, and applied
 * as its z-index. Compartments use z-compound-depth: bottom, so they stay below entities and edges
 * whatever their z-index; it only orders compartments among themselves.
 */

import { Core } from 'cytoscape';
import { CompartmentTreeNode, LABEL_CLASS } from 'src/app/core/models/reactome-instance.model';

/** z distance between two levels of the hierarchy. */
export const COMPARTMENT_Z_STEP = 10;
/** The inner layer of a two-layer compartment sits above its outer layer so it is selected first. */
export const COMPARTMENT_INNER_Z_OFFSET = 5;
/** Label nodes for editing compartment names stay above every compartment so they can be dragged. */
export const COMPARTMENT_LABEL_Z_INDEX = 1000;

/**
 * Map each compartment's dbId to its depth in the tree. A compartment surroundedBy several others
 * appears more than once; the largest depth is kept so that it ends up above all of them.
 */
export function getCompartmentDepths(tree: CompartmentTreeNode): Map<number, number> {
    const dbId2depth = new Map<number, number>();
    const stack: CompartmentTreeNode[] = [tree];
    while (stack.length > 0) {
        const node = stack.pop()!;
        const depth = dbId2depth.get(node.dbId);
        if (depth === undefined || node.depth > depth)
            dbId2depth.set(node.dbId, node.depth);
        stack.push(...(node.children ?? []));
    }
    return dbId2depth;
}

export function getCompartmentZ(depth: number, isInner: boolean): number {
    return depth * COMPARTMENT_Z_STEP + (isInner ? COMPARTMENT_INNER_Z_OFFSET : 0);
}

/**
 * The id shared by the outer and inner layers of one drawn compartment: the node id without its
 * '-outer'/'-inner' suffix. For a compartment loaded from the diagram JSON this is the id of the
 * compartment in that JSON.
 */
export function getCompartmentLayerKey(node: any): string {
    return node.id().replace(/-(outer|inner)$/, '');
}

/**
 * Assign data('z') and the matching z-index to every compartment node in cy. Without dbId2depth
 * (the tree has not arrived, or could not be fetched), and for compartments that are not in the
 * tree, the depth is worked out from the drawing instead: one level below the deepest compartment
 * whose bounds contain it, or 0 if none does.
 * @param cy
 * @param dbId2depth from getCompartmentDepths()
 * @param layerKey2dbId dbIds by getCompartmentLayerKey(), for the compartments loaded from the
 * diagram JSON: the library builds their nodes without a reactomeId.
 */
export function assignCompartmentZOrder(cy: Core, dbId2depth?: Map<number, number>, layerKey2dbId?: Map<string, number>) {
    const compartments = cy.nodes('.Compartment');
    compartments.filter(node => node.hasClass(LABEL_CLASS)).style('z-index', COMPARTMENT_LABEL_Z_INDEX);
    const layers = compartments.filter(node => !node.hasClass(LABEL_CLASS));

    const node2depth = new Map<string, number>();
    const unknown: any[] = [];
    layers.forEach(node => {
        const dbId = Number(node.data('reactomeId')) || layerKey2dbId?.get(getCompartmentLayerKey(node));
        const depth = dbId ? dbId2depth?.get(dbId) : undefined;
        if (depth === undefined)
            unknown.push(node);
        else
            node2depth.set(node.id(), depth);
    });
    // Containers first, so that a compartment that is not in the tree can still sit inside another one.
    unknown.sort((a, b) => area(b) - area(a));
    for (const node of unknown) {
        const box = node.boundingBox({ includeLabels: false, includeOverlays: false });
        const key = getCompartmentLayerKey(node);
        let depth = 0;
        layers.forEach(other => {
            const otherDepth = node2depth.get(other.id());
            // Not the other layer of the same compartment, which always contains (or is contained by) this one
            if (otherDepth === undefined || getCompartmentLayerKey(other) === key)
                return;
            if (otherDepth + 1 > depth && contains(other.boundingBox({ includeLabels: false, includeOverlays: false }), box))
                depth = otherDepth + 1;
        });
        node2depth.set(node.id(), depth);
    }

    layers.forEach(node => {
        const z = getCompartmentZ(node2depth.get(node.id())!, node.hasClass('inner'));
        node.data('z', z);
        node.style('z-index', z);
    });
}

function area(node: any): number {
    return node.width() * node.height();
}

function contains(outer: any, inner: any): boolean {
    return outer.x1 <= inner.x1 && outer.y1 <= inner.y1 && outer.x2 >= inner.x2 && outer.y2 >= inner.y2;
}
