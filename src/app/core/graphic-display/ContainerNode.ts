import { Node } from './Node';
import { DefaultRenderConstants } from './DefaultRenderConstants';
import { Renderable } from './Renderable';
import { RenderablePathway } from './RenderablePathway';
import { Rectangle } from './Rectangle';
import { Point } from './Point';
import { Graphics } from './Graphics';
import { SelectionPosition } from './Node';
import { HyperEdge } from './HyperEdge';
import { Maybe, isUndef } from './Utils';

export abstract class ContainerNode extends Node {
    // a flat list of all subunits. This is different from components in that
    // component can have hierarchy, but subunits can't
    // Used to control if components should be drawn. Default is false
    protected hideComponents: boolean = false;
    // A flag to avoid calculate textbounds from bounds
    protected blockTextPositionFromBoundsCall: boolean = false;
    protected textPadding: number = 0;

    constructor(displayName?: string) {
        super(displayName);
        this.textPadding = DefaultRenderConstants.ROUND_RECT_ARC_WIDTH / 4;
    }

    public doHideComponents(hide: boolean): void {
        this.hideComponents = hide;
        // Make sure all contained components is hidden
        if (!isUndef(this.components)) {
            for (let r of this.components!) {
                r.setIsVisible(!hide);
                if (r instanceof ContainerNode) {
                    (r as ContainerNode).doHideComponents(hide);
                }
            }
        }
    }

    public isComponentsHidden(): boolean {
        return this.hideComponents;
    }

    /**
     * This method is used to ensure the text is still encapsulated
     * by the bounds during resizing.
     *
     * @param needValidate True if the text bounds need to be re-calculated; false otherwise
     */
    protected ensureTextInBounds(needValidate: boolean): void {
        if (isUndef(this.textBounds) || isUndef(this.bounds))
            return;
        this.ensureTextInBoundsForRect(this.bounds!);
        // Call this method to make sure text can be wrapped around if the width
        // is changed.
        if (needValidate)
            this.invalidateTextBounds();
    }

    protected ensureTextInBoundsForRect(bounds: Rectangle): void {
        if (isUndef(this.textBounds)) {
            return;
        }
        // Check the top-left corner.
        // boundsBuffer has been considered in all textbounds related calculations
        if (this.textBounds!.x < bounds.x + this.textPadding)
            this.textBounds!.x = bounds.x + this.textPadding;
        if (this.textBounds!.y < bounds.y + this.textPadding)
            this.textBounds!.y = bounds.y + this.textPadding;
        // Check the bottom-right corner
        let diff = this.textBounds!.x + this.textBounds!.width - bounds.x - bounds.width + this.textPadding;
        if (diff > 0)
            this.textBounds!.x -= diff;
        diff = this.textBounds!.y + this.textBounds!.height - bounds.y - bounds.height + this.textPadding;
        if (diff > 0)
            this.textBounds!.y -= diff;
    }

    public override move(dx: number, dy: number): void {
        if (isUndef(this.bounds))
            return;
        switch (this.selectionPosition) {
            // Do resizing
            case SelectionPosition.NORTH_EAST :
                this.bounds!.width += dx;
                this.bounds!.height -= dy;
                this.bounds!.y += dy;
                this.validateBoundsInView();
                this.ensureTextInBounds(true);
                this.validateMinimumBounds();
                break;
            case SelectionPosition.SOUTH_EAST :
                this.bounds!.width += dx;
                this.bounds!.height += dy;
                this.validateBoundsInView();
                this.ensureTextInBounds(true);
                this.validateMinimumBounds();
                break;
            case SelectionPosition.SOUTH_WEST :
                this.bounds!.x += dx;
                this.bounds!.width -= dx;
                this.bounds!.height += dy;
                this.validateBoundsInView();
                this.ensureTextInBounds(true);
                this.validateMinimumBounds();
                break;
            case SelectionPosition.NORTH_WEST :
                this.bounds!.x += dx;
                this.bounds!.y += dy;
                this.bounds!.width -= dx;
                this.bounds!.height -= dy;
                this.validateBoundsInView();
                this.ensureTextInBounds(true);
                this.validateMinimumBounds();
                break;
            case SelectionPosition.TEXT :
                if (!isUndef(this.textBounds)) {
                    this.textBounds!.x += dx;
                    this.textBounds!.y += dy;
                    this.ensureTextInBounds(false);
                    this.blockTextPositionFromBoundsCall = true;
                }
                break;
                // for node feature
            case SelectionPosition.FEATURE :
            case SelectionPosition.STATE :
                this.moveNodeAttachment(dx, dy);
                break;
            // Treat node as the default
            default :
                // Need to get correct dx, dy to avoid out of the view
                let dx1 = dx;
                let dy1 = dy;
                if (ContainerNode.ensureBoundsInView) {
                    if (this.bounds!.x + dx < this.pad)
                        dx1 = -this.bounds!.x + this.pad;
                    if (this.bounds!.y + dy < this.pad)
                        dy1 = -this.bounds!.y + this.pad;
                }
                this.bounds!.x += dx1;
                this.bounds!.y += dy1;
                // Make sure text can be moved too
                if (this.textBounds != null) {
                    this.textBounds.x += dx1;
                    this.textBounds.y += dy1;
                }
                this.moveComponents(dx1, dy1);
                break;
        }
        this.validatePositionFromBounds();
        if (!isUndef(this.getContainer()) && !(this.getContainer() instanceof RenderablePathway))
            this.getContainer()!.invalidateBounds();
        this.invalidateConnectWidgets();
        this.invalidateNodeAttachments();
    }

    /**
     * Move contained components. This method should be called during moving.
     *
     * @param dx Value to move along the x-axis
     * @param dy Value to move along the y-axis
     */
    protected moveComponents(dx: number, dy: number): void {
        const components: Maybe<Renderable[]> = this.getComponents();
        if (isUndef(components) || components!.length == 0)
            return;
        for (let r of components!) {
            r.move(dx, dy);
        }
    }

    private validateBoundsForSubunits(g: Graphics) {
        const components = this.getComponents();
        if (isUndef(components) || components!.length === 0) {
            return;
        }
        for (let i = 0; i < components!.length; i++) {
            let renderable = components![i];
            if (renderable instanceof Node) {
                (renderable as Node).validateBounds(g);
            } else if (renderable instanceof HyperEdge) {
                (renderable as HyperEdge).validateBounds();
            }
        }
    }

    public setBoundsFromComponents(): void {
        const componentList = this.getComponents();
        if (isUndef(componentList) || componentList!.length == 0 || this.hideComponents) {
            return;
        }

        let node: Renderable = componentList![0];
        let rect: Maybe<Rectangle> = node.getBounds();

        if (isUndef(rect)) {
            return;
        }

        if (isUndef(this.bounds)) {
            this.bounds = new Rectangle(rect!.x, rect!.y, rect!.width, rect!.height);
        } else {
            this.bounds!.x = rect!.x;
            this.bounds!.y = rect!.y;
            this.bounds!.width = rect!.width;
            this.bounds!.height = rect!.height;
        }

        for (let i = 1; i < componentList!.length; i++) {
            node = componentList![i];
            rect = node.getBounds();

            if (isUndef(rect)) {
                continue;
            }

            const maxX: number = this.bounds!.x + this.bounds!.width;
            const maxY: number = this.bounds!.y + this.bounds!.height;

            if (this.bounds!.x > rect!.x) {
                this.bounds!.x = rect!.x;
                this.bounds!.width = maxX - this.bounds!.x;
            }

            if (this.bounds!.y > rect!.y) {
                this.bounds!.y = rect!.y;
                this.bounds!.height = maxY - this.bounds!.y;
            }

            if (this.bounds!.getMaxX() < rect!.getMaxX()) {
                this.bounds!.width = Math.floor(rect!.getMaxX() - this.bounds!.x + 1);
            }

            if (this.bounds!.getMaxY() < rect!.getMaxY()) {
                this.bounds!.height = Math.floor(rect!.getMaxY() - this.bounds!.y + 1);
            }
        }

        if (isUndef(this.position)) {
            this.position = new Point(Math.floor(this.bounds!.getCenterX()),
                                      Math.floor(this.bounds!.getCenterY()));
        }

        // Make it a little shift
        this.bounds!.x -= 1;
        this.bounds!.y -= 1;
        this.bounds!.width += 1;
        this.bounds!.height += 1;

        // Have to make sure text layout is correct
        this.invalidateTextBounds();
    }

    public override removeComponent(renderable: Renderable): Maybe<Renderable> {
        if(!isUndef(this.components)) {
            let removed: boolean = false;
            let newComponents = this.components!.filter(r => r === renderable);
            if (newComponents.length < this.components!.length) {
                removed = true;
            }
            this.components! = newComponents;
            if (removed) {
              return renderable;
            }
        }
        return undefined;
    }

    /**
     * Check if a Renderable object can be assigned to this Container object.
     *
     * @param r Renderable object to check to see if it can be assigned
     * @return true if the Renderable object can be assigned; false otherwise
     */
    public abstract isAssignable(r: Renderable): boolean;

    /**
     * Check a Renderable object to see if its container setting is correct
     * against this ContainerNode. Re-assign it to the correct container if
     * it is not.
     *
     * @param r Renderable object to check
     */
    public validateContainerSetting(r: Renderable): void {
        // A hidden complex cannot take anything
        if (r === this || !this.isVisible) {
            return;
        }
        if (this.isAssignable(r)) {
            if (r.getContainer() !== this) {
                // It should not be removed from a pathway container.
                if (!isUndef(r.getContainer()) &&
                    r.getContainer()! instanceof RenderablePathway) {
                    r.getContainer()!.removeComponent(r);
                }
                r.setContainer(this);
                this.addComponent(r);
            }
        } else if (r.getContainer() === this) {
            // TODO: Commented out due to lack of RenderUtility
            // r.setContainer(RenderUtility.getTopMostContainer(r.getContainer()));
            this.removeComponent(r);
        }
    }

    /**
     * Check if this Container contains the passed Renderable object.
     *
     * @param renderable Renderable to check to see if it is contained in this Container
     * @returns true if it is contained by this container (or one its ancestor containers); false otherwise
     */
    public contains(renderable: Renderable): boolean {
        let container: Maybe<Renderable> = renderable.getContainer();
        while (!isUndef(container) && !(container! instanceof RenderablePathway)) {
            if (container === this) {
                return true;
            }
            container = container!.getContainer();
        }
        return false;
    }

    /**
     * A helper method to check if this complex is picked
     * up by checking a text bounds without boundsbuffer.
     *
     * @param point Point to check if it is within the text bounds
     * @returns true if the point is within the text bounds; false otherwise
     */
    protected isTextPicked(point: Point): boolean {
        if (isUndef(this.textBounds)) {
            return false;
        }
        let x1: number = this.textBounds!.x + this.boundsBuffer;
        let y1: number = this.textBounds!.y + this.boundsBuffer;
        let x2: number = this.textBounds!.x + this.textBounds!.width - this.boundsBuffer;
        let y2: number = this.textBounds!.y + this.textBounds!.height - this.boundsBuffer;
        if (point.x > x1 && point.x < x2 &&
            point.y > y1 && point.y < y2) {
            return true;
        }
        return false;
    }
}
