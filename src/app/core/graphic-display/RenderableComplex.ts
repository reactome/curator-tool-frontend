import { ContainerNode } from './ContainerNode';
import { Graphics } from './Graphics';
import { Point } from './Point';
import { Rectangle } from './Rectangle';
import { Renderable } from './Renderable';
import { Note } from './Note';
import { DefaultRenderConstants } from './DefaultRenderConstants';
import { Node, SelectionPosition } from './Node';
import { PathwayShortcut } from './PathwayShortcut';
import { Maybe, isUndef } from './Utils';

/**
 * This class describes a renderable Complex.
 */
export class RenderableComplex extends ContainerNode {
    // For stoichiometries
    private stoichiometries: Maybe<Map<Renderable, number>>;
    // Cache the hierarchy of all contained components for performance reason
    private componentsInHierarchy: Maybe<Renderable[]>;
    // This is used to keep the old bounds so that they can be recovered for
    // components hiding.
    // Note: to make it a little simplier, the old bounds for this complex is saved
    // in this map too.
    private oldIdToBounds: Maybe<Map<number, Rectangle>>;

    /** Creates a new instance of RenderableComplex */
    constructor(displayName: string) {
        super(displayName);
        this.stoichiometries = new Map();
        this.components = [];
        this.backgroundColor = DefaultRenderConstants.DEFAULT_COMPLEX_BACKGROUND;
        this.isFeatureAddable = true;
        this.isStateAddable = true;
        this.isMultimerFormable = true;
        this.textPadding = 0;
    }

    public override addComponent(renderable: Renderable): void {
        if (!isUndef(this.components)){
            this.components!.push(renderable);
            this.rebuildHierarchy();
            if (this.hideComponents) {
                renderable.setIsVisible(false);
                if (renderable instanceof ContainerNode) {
                    (renderable as ContainerNode).doHideComponents(true);
                }
            }
        }
    }

    /**
     * Call this method to rebuild the internal hierarchy structure. This
     * method should be called when the client has a doubt regarding the
     * internal hierarchy structure of this complex.
     */
    public rebuildHierarchy(): void {
        // TODO: Commented out due to lack of RenderUtility
        // this.componentsInHierarchy = RenderUtility.getComponentsInHierarchy(this);
    }

    /**
     * Remove a list of Objects from the contained components.
     *
     * @param deletion a list of Objects to be removed
     * @return a list of objects that are removed actually
     */
    public removeAll(deletion: Renderable[]): Renderable[] {
        let list: Renderable[] = [];
        for (let r of deletion) {
            let deleted: Maybe<Renderable> = this.removeComponent(r);
            if (!isUndef(deleted)) {
                list.push(deleted!);
            }
        }
        return list;
    }

    public override removeComponent(renderable: Renderable): Maybe<Renderable> {
        const target: Renderable = this.getTarget(renderable);
        this.stoichiometries!.delete(target);
        if (!isUndef(this.componentsInHierarchy)) {
            this.componentsInHierarchy! = this.componentsInHierarchy!.filter(it => it === renderable);
        }
        if (!isUndef(this.oldIdToBounds)) {
            this.oldIdToBounds!.delete(renderable!.getID());
        }
        return super.removeComponent(renderable!);
    }

    public overridegenerateShortcut(): Renderable {
        const shortcut: RenderableComplex = new RenderableComplex("");
        shortcut.hideComponents = this.hideComponents;
       this.generateShortcutMain(shortcut as unknown as Node);
        if (!isUndef(this.textBounds)) {
            shortcut.setTextPosition(this.textBounds!.x, this.textBounds!.y);
        }
        return shortcut as unknown as Renderable;
    }

    public getSubunits(): Set<Node> {
        const subunits: Set<Node> = new Set();
        this.getSubunitsMain(this as unknown as Renderable, subunits);
        return subunits;
    }

    private getSubunitsMain(node: Renderable, subunits: Set<Node>): void {
        const comps = node.getComponents();
        if (isUndef(comps) || comps!.length === 0) {
            // Treat an empty complex as a subunit. This might not be good.
            if (node instanceof PathwayShortcut) {
                subunits.add((node as PathwayShortcut).getTarget() as Node);
            } else {
                subunits.add(node as Node);
            }
        } else {
            for (const node of comps!) {
                this.getSubunitsMain(node as Renderable, subunits);
            }
        }
    }

    public override isPicked(p: Point): boolean {
        // reset
        this.selectionPosition = SelectionPosition.NONE;
        if (!this.isVisible || isUndef(this.bounds))
            return false;

        // Check contained components first
        // Need to check contained components in an order
        if (!isUndef(this.componentsInHierarchy) && this.componentsInHierarchy!.length > 0) {
            for (let r of this.componentsInHierarchy!) {
                if (r.isPicked(p))
                    return false;
            }
        }

        if (this.isResizeWidgetPicked(p))
            return true;

        if (this.isNodeAttachmentPicked(p))
            return true;

        return this.bounds!.contains(p);
    }

    public pickUpContainer(node: Node): Maybe<RenderableComplex> {
        if (!isUndef(this.componentsInHierarchy)) {
            for (let r of this.componentsInHierarchy!) {
                if (!(r instanceof RenderableComplex))
                    continue;

                let complex: RenderableComplex = r as RenderableComplex;

                if ((complex as RenderableComplex).isAssignable(node))
                    return complex;
            }
        }

        return this.isAssignable(node) ? this : undefined;
    }

    public getStoichiometries(): Map<Renderable, number> {
        return this.stoichiometries!;
    }

    /**
     * Set the stoichiometry for a specified Renderable object.
     *
     * @param renderable The Renderable object
     * @param value The Renderable object's new stoichiometry
     */
    public setStoichiometry(renderable: Renderable, value: number): void {
        if (value <= 0) {
            throw new Error("RenderableComplex.setStoichiometry(): value should be greater than 0.");
        }
        const oldValue: Maybe<number> = this.stoichiometries!.get(renderable);
        if (!isUndef(oldValue) && oldValue === value) {
            return;
        }
        const target: Renderable = this.getTarget(renderable);
        this.stoichiometries!.set(target, value);
        // Have to make sure renderable is in the components
        if (!isUndef(this.components)) {
            for (const component of this.components!) {
                let r: Renderable = component;
                if (r instanceof PathwayShortcut) {
                    r = (r as PathwayShortcut).getTarget();
                }
                if (r === target) {
                    return;
                }
            }
        }
        this.addComponent(renderable);
    }

    private getTarget(r: Renderable): Renderable {
        if (r instanceof PathwayShortcut) {
            return (r as PathwayShortcut).getTarget();
        }
        return r;
    }

    /**
     * Override the super class method to handle components if they have been hidden.
     *
     * @param dx Value to move along the x-axis
     * @param dy Value to move along the y-axis
     */
    public override move(dx: number, dy: number): void {
        super.move(dx, dy);
        if (this.hideComponents && this.isResizing()) {
            // Want to make all components to have the same sizing as the current components
            this.copyBoundsToComponents();
        }
    }

    public override doHideComponents(hide: boolean): void {
        if (this.hideComponents === hide) {
            return; // Nothing to do
        }
        this.hideComponents = hide;
        if (isUndef(this.componentsInHierarchy)) {
            return;
        }
        for (let r of this.componentsInHierarchy!) {
            let node = r as Node;
            node.setIsVisible(!hide);
            if (r instanceof RenderableComplex) {
                (r as RenderableComplex).hideComponents = hide;
            }
        }
        // The following statements are related to bounds.
        if (isUndef(this.bounds)) {
            return;
        }
        if (hide) {
            this.saveOldBounds();
            this.copyBoundsToComponents();
        } else {
            this.recoverOldBounds();
            // Make sure a complex container has enough size
            let container = this.container;
            let childBounds: Maybe<Rectangle> = this.bounds!;
            while (container instanceof RenderableComplex) {
                let cBounds = container.getBounds();
                if (!isUndef(cBounds) && !isUndef(childBounds) && !cBounds!.containsRectangle(childBounds!)) {
                    (container as RenderableComplex).layout();
                }
                childBounds = container.getBounds();
                container = container.getContainer();
            }
        }
    }

    private recoverOldBounds(): void {
        // Make sure it is recoverable. If not, just do a simple
        // layout
        if (!this.isOldBoundsRecoverable()) {
            // Copy any known bounds
            if (!isUndef(this.oldIdToBounds) && !isUndef(this.componentsInHierarchy)) {
                for (let r of this.componentsInHierarchy!) {
                    let bounds = this.oldIdToBounds!.get(r.getID());
                    if (isUndef(bounds)) {
                        continue;
                    }
                    if (r instanceof RenderableComplex) {
                        if (!isUndef((r as RenderableComplex).bounds)) {
                            (r as RenderableComplex).bounds!.width = bounds!.width;
                            (r as RenderableComplex).bounds!.height = bounds!.height;
                        } else {
                            (r as RenderableComplex).bounds = new Rectangle(bounds!.x, bounds!.y, bounds!.width, bounds!.height);
                        }
                    }
                }
                // Just do an auto layout. Should start from the smallest complexes
                for (let r of this.componentsInHierarchy!) {
                    if (r instanceof RenderableComplex) {
                        (r as RenderableComplex).layout();
                    }
                }
                this.layout();
                return;
            }
            if (isUndef(this.oldIdToBounds) || isUndef(this.bounds)) {
                return;
            }
            let oldBounds = this.oldIdToBounds!.get(this.getID());
            if (isUndef(oldBounds)) {
                return;
            }
            let dx = this.bounds!.x - oldBounds!.x;
            let dy = this.bounds!.y - oldBounds!.y;
            this.bounds!.width = oldBounds!.width;
            this.bounds!.height = oldBounds!.height;
            this.invalidateTextBounds();
            if (isUndef(this.componentsInHierarchy)) {
                return;
            }
            for (let r of this.componentsInHierarchy!) {
                oldBounds = this.oldIdToBounds!.get(r.getID());
                oldBounds!.translate(dx, dy);
                let newBounds = r.getBounds();
                if (isUndef(newBounds)) {
                    newBounds = new Rectangle(oldBounds!.x, oldBounds!.y, oldBounds!.width, oldBounds!.height)  ;
                    r.setBounds(newBounds);
                } else {
                    newBounds!.x = oldBounds!.x;
                    newBounds!.y = oldBounds!.y;
                    newBounds!.width = oldBounds!.width;
                    newBounds!.height = oldBounds!.height;
                }
                (r as Node).invalidateTextBounds();
            }
        }
    }

    private isOldBoundsRecoverable(): boolean {
        if (isUndef(this.oldIdToBounds) || this.oldIdToBounds!.size == 0) {
            return false;
        }

        // Make sure all nodes have been registered
        if (isUndef(this.componentsInHierarchy) || this.componentsInHierarchy!.length == 0) {
            return false;
        }

        for (let r of this.componentsInHierarchy!) {
            if (!(r.getID() in this.oldIdToBounds!)) {
                return false;
            }
        }

        // Check if a complex component has the same size as its container
        for (let r of this.componentsInHierarchy!) {
            if (!(r instanceof RenderableComplex)) {
                continue;
            }

            let complex: RenderableComplex = r as RenderableComplex;
            let complexBounds: Maybe<Rectangle> = this.oldIdToBounds!.get(complex.getID());
            if (isUndef(complexBounds)) {
                continue;
            }
            // TODO: Commented out due to lack of RenderUtility
            // let list: Renderable[] = RenderUtility.getComponentsInHierarchy(complex);
            let list: Renderable[] = []; // Placeholder for the above
            for (let tmp of list) {
                let tmpBounds: Maybe<Rectangle> = this.oldIdToBounds!.get(tmp.getID());
                if (!isUndef(tmpBounds) &&
                    tmpBounds!.width == complexBounds!.width &&
                    tmpBounds!.height == complexBounds!.height) {
                    return false;
                }
            }
        }

        return true;
    }

    private saveOldBounds(): void {
        if (isUndef(this.oldIdToBounds)) {
            this.oldIdToBounds = new Map<number, Rectangle>();
        } else {
            this.oldIdToBounds!.clear();
        }

        // Save the bounds for this RenderableComplex
        if (!isUndef(this.bounds)) {
            this.oldIdToBounds!.set(this.getID(), new Rectangle(this.bounds!.x, this.bounds!.y, this.bounds!.width, this.bounds!.height));

            if (!isUndef(this.componentsInHierarchy)) {
                  for (let r of this.componentsInHierarchy!) {
                      let rBounds: Maybe<Rectangle> = r.getBounds();
                      if (!isUndef(rBounds)) {
                          this.oldIdToBounds!.set(r.getID(), new Rectangle(rBounds!.x, rBounds!.y, rBounds!.width, rBounds!.height));
                      }
                  }
            }
        }
    }

    /**
     * Get the old bounds for hidden components.
     *
     * @return Map of component id to bounds
     */
    public getOldBounds(): Maybe<Map<number, Rectangle>> {
        return this.oldIdToBounds;
    }

    /**
     * Set the old bounds for hidden components.
     *
     * @param oldBounds Map of component id to bounds
     */
    public setOldBounds(oldBounds: Map<number, Rectangle>): void {
        this.oldIdToBounds = oldBounds;
    }

    /**
     * This method is used to copy the bounds of this complex to
     * all it contained components.
     */
    public copyBoundsToComponents(): void {
        if (isUndef(this.bounds) || isUndef(this.componentsInHierarchy) ||
            this.componentsInHierarchy!.length == 0)
            return;
        for (let r of this.componentsInHierarchy!) {
            if (r instanceof RenderableComplex) {
                if (isUndef(r.bounds)) {
                    r.bounds = new Rectangle(
                      this.bounds!.x, this.bounds!.y, this.bounds!.width, this.bounds!.height);
                    if (!isUndef(r.getPosition()))
                        r.setPosition(new Point(0, 0));
                    (r as RenderableComplex).validatePositionFromBounds();
                }
                else {
                    r.bounds!.x = this.bounds!.x;
                    r.bounds!.y = this.bounds!.y;
                    r.bounds!.width = this.bounds!.width;
                    r.bounds!.height = this.bounds!.height;
                }
                (r as unknown as Node).invalidateTextBounds();
            }
        }
    }

    private isResizing(): boolean {
        if (!isUndef(this.selectionPosition)) {
            if (this.selectionPosition! == SelectionPosition.NORTH_EAST ||
                this.selectionPosition! == SelectionPosition.NORTH_WEST ||
                this.selectionPosition! == SelectionPosition.SOUTH_EAST ||
                this.selectionPosition! == SelectionPosition.SOUTH_WEST)
                return true;
         }
        return false;
    }

    /**
     * Automatically layout this RenderableComplex.
     *
     */
    public layout(): void {
        if (this.hideComponents) {
            return;  // Don't do layout for hiding components
        }
        let componentList = this.getComponents();
        if (isUndef(componentList) || componentList!.length == 0)
            return;
        let size = componentList!.length;
        let c = Math.ceil(Math.sqrt(size));
        let rs: Node[][] = new Array(c).fill(undefined).map(() => new Array(c).fill(undefined));
        let index = 0;
        // Distribute
        for (let i = 0; i < c && index < size; i++) { // Row
            for (let j = 0; j < c && index < size; j++) { // Col
                rs[i][j] = componentList![index] as Node;
                index++;
            }
        }
        // Assign positions
        // Original position
        if (isUndef(this.position)) {
            return;
        }
        let x = this.position!.x;
        let y = this.position!.y;
        // TODO: Commented out temporarily due to lack of Dimension
        // let layerSize: Dimension = new Dimension(); // TODO: Commented out temporarily due to lack of Dimension

        let isDone = false;
        let r: Maybe<Node>;
        let bounds: Maybe<Rectangle>;
        let dx = 0;
        let x0 = 0;
        let y0 = 0;
        for (let i = 0; i < c && !isDone; i++) { // Row
            // Get the center for each layer
            // TODO: Commented out temporarily due to lack of Dimension layerSize.width = 0;
            // TODO: Commented out temporarily due to lack of Dimension layerSize.height = 0;
            for (let j = 0; j < c; j++) { // Col
                if (isUndef(rs[i][j])) {
                    isDone = true;
                    break;
                }
                r = rs[i][j]!;
                // TODO: Commented out temporarily due to lack of Dimension
//                 if (r.getStoiBounds() !== undefined) {
//                     layerSize.width += r.getStoiBounds()!.width;
//                 }
                if (!isUndef(r.getBounds())) {
                    // TODO: Commented out temporarily due to lack of Dimension layerSize.width += r.getBounds()!.width;
                    // TODO: Commented out temporarily due to lack of Dimension
//                     if (r.getBounds()!.height > layerSize.height)
//                         layerSize.height = r.getBounds()!.height;
                }
                // TODO: Commented out temporarily due to lack of Dimension
//                 else {
//                     layerSize.width += Node.getNodeWidth();
//                     layerSize.height += 20; // arbitrarily
//                 }
            }
            // TODO: Commented out temporarily due to lack of Dimension
//             if (layerSize.width == 0) // nothing is layered.
//                 break;
            // Assign positions to this layer.
            // TODO: Commented out temporarily due to lack of Dimension
//             x = -layerSize.width / 2 + this.position!.x;
//             y += layerSize.height / 2;
            for (let j = 0; j < c; j++) {
                if (isUndef(rs[i][j]))
                    break;
                r = rs[i][j] as Node;
                if (!isUndef(r.getPosition())) {
                    // All are nodes
                    dx = 0;
                    if (!isUndef(r.getStoiBounds()))
                        dx = r.getStoiBounds()!.width;
                    if (!isUndef(r.getBounds()))
                        dx += r.getBounds()!.width / 2;
                    else
                        dx += Node.getNodeWidth() / 2;
                    x += dx;
                    x0 = r.getPosition()!.x;
                    y0 = r.getPosition()!.y;
                    // Need to call move to change positions of components in subcomplexes.
                    r.move(x - x0,
                        y - y0);
                    dx += 1; // A little cushion
                    x += dx; // Move to the right end
                }
            }
            // TODO: Commented out temporarily due to lack of Dimension
            // y += layerSize.height / 2 + 2; // Make subunits look together
        }
        // Want to keep at the original position
        x0 = this.position!.x;
        y0 = this.position!.y;
        this.setBoundsFromComponents();
        dx = x0 - this.position!.x;
        let dy = y0 - this.position!.y;
        this.move(dx, dy);
        // Should not call the following method since it will invalidate the
        // layout results.
        this.invalidateTextBounds();
    }

    public override setBoundsFromComponents(): void {
        super.setBoundsFromComponents();
        // Need to calculate the text layout position
        if (!isUndef(this.components) && this.components!.length > 0
            && !isUndef(this.textBounds) && !isUndef(this.bounds)) {
            // Create a union
            this.textBounds!.y = this.bounds!.y + this.bounds!.height + 2;
            let x1 = Math.min(this.textBounds!.x, this.bounds!.x);
            let y1 = Math.min(this.textBounds!.y, this.bounds!.y);
            let x2 = Math.max(this.textBounds!.x + this.textBounds!.width,
                              this.bounds!.x + this.bounds!.width);
            let y2 = Math.max(this.textBounds!.y + this.textBounds!.height,
                              this.bounds!.y + this.bounds!.height);
            this.bounds!.x = x1;
            this.bounds!.y = y1;
            this.bounds!.width = x2 - x1;
            this.bounds!.height = y2 - y1;
            // Make sure text in the middle of the bottom
            this.textBounds!.x = this.bounds!.x + (this.bounds!.width - this.textBounds!.width) / 2;
            this.validatePositionFromBounds();
            this.needCheckBounds = false;
            this.needCheckTextBounds = false;
        }
    }

    /**
     * Get the stoichiometry for a specified Renderable object.
     *
     * @param renderable The query object
     * @return The stoichiometry
     */
    public getStoichiometry(renderable: Renderable): number {
        if (isUndef(this.stoichiometries)) {
            return 0;
        }
        const value: Maybe<number> = this.stoichiometries!.get(this.getTarget(renderable));
        if (isUndef(value))
            return 0;
        else
            return value!;
    }

    public override getComponentByName(name: string): Maybe<Renderable> {
        let renderable: Maybe<Renderable>;
        if (!isUndef(this.components)) {
            for (const it of this.components!) {
                renderable = it;
                if (renderable.getDisplayName() === name)
                    return renderable;
            }
        }
        return undefined;
    }

    public override getType(): string {
        return "Complex";
    }

    public override getLinkWidgetPositions(): Maybe<Point[]> {
        // Just recalculate the positions
        // since it is not reset in validateBounds().
        this.resetLinkWidgetPositions();
        return super.getLinkWidgetPositions();
    }

    /**
     * Check if a passed Renderable object can be a Complex's component.
     *
     * @param renderableObject Renderable object to be assigned
     * @return true if the Renderable object passed is not this RenderableComplex, a RenderableCompartment,
     * RenderablePathway, or Note, and it is contained within this RenderableComplex's bounds; false otherwise
     */
    public override isAssignable(renderableObject: Renderable): boolean {
        if (isUndef(this.bounds) || renderableObject === this as unknown as Renderable) // Don't point it to itself
            return false; // This container has not be materialized
        if (renderableObject instanceof Node) {
            if (
                renderableObject.getType() === "Compartment" ||
                renderableObject.getType() === "Pathway" ||
                renderableObject instanceof Note)
                return false;
            // Need to check based on bounds. Should have a full containing
            if (isUndef(renderableObject.getBounds()))
                return this.bounds!.contains(renderableObject.getPosition());
            else
                return this.bounds!.containsRectangle(renderableObject.getBounds()!);
        }
        return false;
    }

    protected override setTextPositionFromBounds() {
        if (isUndef(this.bounds))
            return; // Wait for bounds is setting.
        if (isUndef(this.textBounds)) {
            this.textBounds = new Rectangle(this.bounds!.x, this.bounds!.y, this.bounds!.width, this.bounds!.height);
        }
        else {
            this.textBounds!.x = this.bounds!.x + (this.bounds!.width - this.textBounds!.width) / 2;
            this.textBounds!.y = this.bounds!.y + this.bounds!.height - this.textBounds!.height;
        }
    }

    /**
     * Break the links of this complex to other shortcuts.
     */
    public delinkToShortcuts(): void {
        if (isUndef(this.shortcuts)) {
            return;
        }
        // An empty shortcuts list maybe used by other shortcuts.
        this.shortcuts! = this.shortcuts!.filter(item => {
            if (item instanceof RenderableComplex) {
                return item === this;
            } else
                return false;
        });

        if (this.shortcuts!.length == 1) {
            this.shortcuts = []; // Don't need to track it.
        }
        this.shortcuts = undefined;
        // Use the following funny way to do a deep clone of attributes.
        // TODO: Commented out temporarily due to lack of GKApplicationUtilities
//         try {
//             this.attributes = GKApplicationUtilities.cloneViaIO(this.attributes);
//         } catch (e) {
//             console.error("RenderableComplex.delinkToShortcuts(): " + e);
//             console.error(e.stack);
//         }
    }

    protected override initBounds(g: Graphics): void {
        super.initBounds(g);
        this.ensureTextInBounds(false);
        if (this.hideComponents) {
            this.copyBoundsToComponents();
        }
    }

}
