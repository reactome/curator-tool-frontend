/**
 * Stack compartments in the pathway diagram by how they are laid out in it: a compartment lying
 * inside the bounds of another one gets a higher z, so it is always drawn - and hit-tested - above
 * the compartments that surround it. Each diagram is stacked by its own layout.
 *
 * The z score is kept on each compartment node as data('z') next to its x/y position, and applied
 * as its z-index. Compartments use z-compound-depth: bottom, so they stay below entities and edges
 * whatever their z-index; it only orders compartments among themselves.
 */

import { Core } from 'cytoscape';
import { LABEL_CLASS } from 'src/app/core/models/reactome-instance.model';

/** z distance between two levels of nesting. */
export const COMPARTMENT_Z_STEP = 10;
/** The inner layer of a two-layer compartment sits above its outer layer so it is selected first. */
export const COMPARTMENT_INNER_Z_OFFSET = 5;
/** Label nodes for editing compartment names stay above every compartment so they can be dragged. */
export const COMPARTMENT_LABEL_Z_INDEX = 1000;

export function getCompartmentZ(depth: number, isInner: boolean): number {
    return depth * COMPARTMENT_Z_STEP + (isInner ? COMPARTMENT_INNER_Z_OFFSET : 0);
}

/**
 * The id shared by the outer and inner layers of one drawn compartment: the node id without its
 * '-outer'/'-inner' suffix.
 */
export function getCompartmentLayerKey(node: any): string {
    return node.id().replace(/-(outer|inner)$/, '');
}

/**
 * Assign data('z') and the matching z-index to every compartment node in cy. A compartment's
 * depth is one level below the deepest other compartment whose bounds contain it, or 0 if none
 * does.
 */
export function assignCompartmentZOrder(cy: Core) {
    const compartments = cy.nodes('.Compartment');
    compartments.filter(node => node.hasClass(LABEL_CLASS)).style('z-index', COMPARTMENT_LABEL_Z_INDEX);
    const layers = compartments.filter(node => !node.hasClass(LABEL_CLASS));

    const node2depth = new Map<string, number>();
    const node2box = new Map<string, any>();
    layers.forEach(node => {
        node2box.set(node.id(), node.boundingBox({ includeLabels: false, includeOverlays: false }));
    });
    // Containers first, so that the depth of every compartment around a node is known when it is reached
    const sorted = layers.toArray().sort((a, b) => area(b) - area(a));
    for (const node of sorted) {
        const box = node2box.get(node.id());
        const key = getCompartmentLayerKey(node);
        let depth = 0;
        for (const other of sorted) {
            const otherDepth = node2depth.get(other.id());
            // Not the other layer of the same compartment, which always contains (or is contained by) this one
            if (otherDepth === undefined || getCompartmentLayerKey(other) === key)
                continue;
            if (otherDepth + 1 > depth && contains(node2box.get(other.id()), box))
                depth = otherDepth + 1;
        }
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
