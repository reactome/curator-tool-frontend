import { Renderable } from './Renderable';
import { Graphics } from './Graphics';
import { Point } from './Point';
import { Rectangle } from './Rectangle';
import { HyperEdge } from './HyperEdge';
import { DefaultRenderConstants } from './DefaultRenderConstants';
import { NodeConnectInfo } from './NodeConnectInfo';
import { ContainerNode } from './ContainerNode';
import { Node } from './Node';
import { SelectionPosition } from './Node';
import { Maybe, isUndef } from './Utils';

export class RenderableCompartment extends ContainerNode {
    private readonly DEFAULT_WIDTH: number = 250;
    // Draw the inner rectangle if any
    private insets: Maybe<Rectangle>;

    constructor() {
        super();
        this.bounds = new Rectangle(0, 0, this.DEFAULT_WIDTH, this.DEFAULT_WIDTH);
        this.boundsBuffer = DefaultRenderConstants.RECTANGLE_DIST;
        this.minWidth = 3 * (DefaultRenderConstants.RECTANGLE_DIST +
                        DefaultRenderConstants.SELECTION_WIDGET_WIDTH);
        //TODO: This should be removed
        this.backgroundColor = DefaultRenderConstants.COMPARTMENT_COLOR;
        this.lineColor = DefaultRenderConstants.COMPARTMENT_OUTLINE_COLOR;
        // Use an empty ConnectInfo to avoid null exception
        this.connectInfo = new NodeConnectInfo();
        // We dont' want to have any linkwdigets, so we
        // just assign null to these widgets
        this.linkWidgetPositions = new Array(4);
        this.isLinkable = false;
        this.isTransferrable = false;
    }

    public override setDisplayName(name: string): void {
        super.setDisplayName(name);
        if (this.isInsetsNeeded()) {
            if (isUndef(this.insets) && !isUndef(this.bounds)) {
                // default value
                let x = this.bounds!.x + DefaultRenderConstants.RECTANGLE_DIST;
                let y = this.bounds!.y + DefaultRenderConstants.RECTANGLE_DIST;
                let width = this.bounds!.width - 2 * DefaultRenderConstants.RECTANGLE_DIST;
                let height = this.bounds!.height - 2 * DefaultRenderConstants.RECTANGLE_DIST;
                this.insets = new Rectangle(x, y, width, height);
            }
        }
        else
            this.insets = undefined;
    }

    /**
     * Disable this method so that nothing is returned.
     *
     * @return undefined
     */
    public override generateShortcut(): Maybe<Renderable> {
        return undefined;
    }

    protected override ensureTextInBounds(needValidate: boolean): void {
        if (isUndef(this.textBounds))
            return;
        if (isUndef(this.insets) || this.insets!.isEmpty())
            if (!isUndef(this.bounds)) {
              this.ensureTextInBoundsForRect(this.bounds!);
            }
        else
            this.ensureTextInBoundsForRect(this.insets!);
        // Call this method to make sure text can be wrapped around if the width
        // is changed.
        if (needValidate)
            this.invalidateTextBounds();
    }

    public override setPosition(p: Point): void {
        super.setPosition(p);
        if (!isUndef(this.bounds)) {
            this.bounds!.x = p.x - this.bounds!.width / 2;
            this.bounds!.y = p.y - this.bounds!.height / 2;
        }
        if (!isUndef(this.insets)) {
            this.insets!.x = p.x - this.insets!.width / 2;
            this.insets!.y = p.y - this.insets!.height / 2;
        }
    }

    public override getType(): string {
        return "Compartment";
    }

    public isInsetsNeeded(): boolean {
        return !isUndef(this.getDisplayName()) && !this.getDisplayName()!.endsWith("membrane");
    }

    public getInsets(): Maybe<Rectangle> {
        return this.insets;
    }

    public setInsets(insets: Rectangle): void {
        this.insets = insets;
    }

    /**
     * This method is used to test if this compartment can be assigned to
     * the passed Renderable object. The checking is based on bounds. If the bounds
     * of the passed object is touched or contained by this compartment bounds,
     * true will be returned. Otherwise, false will be returned.
     *
     * @param renderable Renderable object to check
     * @return true if the Renderable object's bounds are intersected (or fully contained in the case of
     * it is another RenderableCompartment); false otherwise
     */
    public isAssignable(renderable: Renderable): boolean {
        if (isUndef(renderable)) {
            return false;
        }
        // Don't assign a compartment to a pathway
        if (renderable.getType() === "Pathway") {
            return false;
        }
        // If a Renderable object is a subunit of a Renderable complex,
        // it should not be assigned to this compartment.
        //TODO: Need to check a case: a complex component has different component setting
        // from its container complex.
        if (renderable.getContainer().getType() === "Complex") {
            return false;
        }
        const renderableBounds = renderable.getBounds();
        // If r is another compartment, r should be contained fully
        if (!isUndef(this.bounds)) {
            if (renderable instanceof RenderableCompartment) {
                return this.bounds!.containsRectangle(renderableBounds);
            }
            // Use position for hyper edge. Otherwise, the behavior is a little strange since the bounds
            // for a reaction usually is too big.
            if (renderable instanceof HyperEdge || isUndef(renderableBounds)) {
                const position = renderable.getPosition();
                if (!isUndef(position)) {
                    return this.bounds!.contains(position!);
                } else {
                    return false;
                }
            }
            return this.bounds!.intersects(renderableBounds!);
        }
        return false;
    }

    public override isPicked(p: Point): boolean {
        // reset
        this.selectionPosition = SelectionPosition.NONE;

        // Check contained components first.
        // Have to be aware that components are double checked.
        if (!isUndef(this.components) && this.components!.length > 0) {
            for (let r of this.components!) {
                if (r.canBePicked(p))
                    return false;
            }
        }
        if (this.isResizeWidgetPicked(p))
            return true;

        // Check if text label is picked
        if (this.isTextPicked(p)) {
            this.selectionPosition = SelectionPosition.TEXT;
            return true;
        }

        if (isUndef(this.bounds)) {
          return false;
        }

        // Want to check if the bands between the bounds and the boundsbuffer is picked
        // Check the distance between P and the bound
        let x = this.bounds!.x + this.boundsBuffer;
        let y = this.bounds!.y + this.boundsBuffer;
        let width = this.bounds!.width - 2 * this.boundsBuffer;
        let height = this.bounds!.height - 2 * this.boundsBuffer;
        let inside: Rectangle = new Rectangle(x, y, width, height);

        if (this.bounds!.contains(p) && !inside.contains(p))
            return true;

        // Check if the insets is clicked
        if (!isUndef(this.insets) && !this.insets!.isEmpty()) {
            inside.x = this.insets!.x + this.boundsBuffer;
            inside.y = this.insets!.y + this.boundsBuffer;
            inside.width = this.insets!.width - 2 * this.boundsBuffer;
            inside.height = this.insets!.height - 2 * this.boundsBuffer;

            if (this.insets!.contains(p) && !inside.contains(p))
                return true;
        }

        return false;
    }

    protected override isResizeWidgetPicked(p: Point): boolean {
        let rtn: boolean = super.isResizeWidgetPicked(p);
        if (rtn) {
            return true;
        }
        if (isUndef(this.insets) || this.insets!.isEmpty()) {
            return false;
        }
        let width = 2 * Node.RESIZE_WIDGET_WIDTH;
        let height = 2 * Node.RESIZE_WIDGET_WIDTH;
        let x = this.insets!.x + this.insets!.width - Node.RESIZE_WIDGET_WIDTH;
        let y = this.insets!.y - Node.RESIZE_WIDGET_WIDTH;
        let resizeWidget: Rectangle = new Rectangle(x, y, width, height);
        if (resizeWidget.contains(p)) {
            this.selectionPosition = SelectionPosition.IN_NORTH_EAST;
            return true;
        }
        // southeast
        resizeWidget.x = this.insets!.x + this.insets!.width - Node.RESIZE_WIDGET_WIDTH;
        resizeWidget.y = this.insets!.y + this.insets!.height - Node.RESIZE_WIDGET_WIDTH;
        if (resizeWidget.contains(p)) {
            this.selectionPosition = SelectionPosition.IN_SOUTH_EAST;
            return true;
        }
        // southwest
        resizeWidget.x = this.insets!.x - Node.RESIZE_WIDGET_WIDTH;
        if (resizeWidget.contains(p)) {
            this.selectionPosition = SelectionPosition.IN_SOUTH_WEST;
            return true;
        }
        // northwest
        resizeWidget.y = this.insets!.y - Node.RESIZE_WIDGET_WIDTH;
        if (resizeWidget.contains(p)) {
            this.selectionPosition = SelectionPosition.IN_NORTH_WEST;
            return true;
        }
        return false;
    }

    public override move(dx: number, dy: number): void {
        if (isUndef(this.bounds)) {
            return;
        }
        switch (this.selectionPosition) {
            // Do resizing
            case SelectionPosition.NORTH_EAST:
                this.bounds!.width += dx;
                this.bounds!.height -= dy;
                this.bounds!.y += dy;
                this.sanityCheckForMove();
                break;
            case SelectionPosition.IN_NORTH_EAST:
                // Make sure insets.x, and insets.y should not
                // out of bounds
                if (!isUndef(this.insets)) {
                    if (this.insets!.y + dy < this.bounds!.y) {
                        dy = this.bounds!.y - this.insets!.y;
                    }
                    this.insets!.width += dx;
                    this.insets!.height -= dy;
                    this.insets!.y += dy;
                    this.sanityCheckForMove();
                }
                break;
            case SelectionPosition.SOUTH_EAST:
                this.bounds!.width += dx;
                this.bounds!.height += dy;
                this.sanityCheckForMove();
                break;
            case SelectionPosition.IN_SOUTH_EAST:
                if (!isUndef(this.insets)) {
                    this.insets!.width += dx;
                    this.insets!.height += dy;
                    this.sanityCheckForMove();
                }
                break;
            case SelectionPosition.SOUTH_WEST:
                this.bounds!.x += dx;
                this.bounds!.width -= dx;
                this.bounds!.height += dy;
                this.sanityCheckForMove();
                break;
            case SelectionPosition.IN_SOUTH_WEST:
                if (!isUndef(this.insets)) {
                    if (this.insets!.x + dx < this.bounds!.x) {
                        dx = this.bounds!.x - this.insets!.x;
                    }
                    this.insets!.x += dx;
                    this.insets!.width -= dx;
                    this.insets!.height += dy;
                    this.sanityCheckForMove();
                }
                break;
            case SelectionPosition.NORTH_WEST:
                this.bounds!.x += dx;
                this.bounds!.y += dy;
                this.bounds!.width -= dx;
                this.bounds!.height -= dy;
                this.sanityCheckForMove();
                break;
            case SelectionPosition.IN_NORTH_WEST:
                if (!isUndef(this.insets)) {
                    if (this.insets!.x + dx < this.bounds!.x) {
                        dx = this.bounds!.x - this.insets!.x;
                    }
                    if (this.insets!.y + dy < this.bounds!.y) {
                        dy = this.bounds!.y - this.insets!.y;
                    }
                    this.insets!.x += dx;
                    this.insets!.y += dy;
                    this.insets!.width -= dx;
                    this.insets!.height -= dy;
                    this.sanityCheckForMove();
                }
                break;
            case SelectionPosition.TEXT:
                if (!isUndef(this.textBounds)) {
                    this.textBounds!.x += dx;
                    this.textBounds!.y += dy;
                    this.ensureTextInBounds(false);
                    this.blockTextPositionFromBoundsCall = true;
                }
                break;
            // for node feature
            case SelectionPosition.FEATURE:
            case SelectionPosition.STATE:
                this.moveNodeAttachment(dx, dy);
                break;
            // Treat node as the default
            default:
                // Need to get correct dx, dy to avoid out of the view
                let dx1: number = dx;
                let dy1: number = dy;
                if (Node.ensureBoundsInView) {
                    if (this.bounds!.x + dx < this.pad) {
                        dx1 = -this.bounds!.x + this.pad;
                    }
                    if (this.bounds!.y + dy < this.pad) {
                        dy1 = -this.bounds!.y + this.pad;
                    }
                }
                this.bounds!.x += dx1;
                this.bounds!.y += dy1;
                // Make sure text can be moved too
                if (!isUndef(this.textBounds)) {
                    this.textBounds!.x += dx1;
                    this.textBounds!.y += dy1;
                }
                if (!isUndef(this.insets)) {
                    this.insets!.x += dx1;
                    this.insets!.y += dy1;
                }
                this.moveComponents(dx1, dy1);
                break;
        }
        this.validatePositionFromBounds();
        if (!isUndef(this.getContainer()) && this.getContainer()!.getType() === "Pathway") {
            this.getContainer()!.invalidateBounds();
        }
        this.invalidateConnectWidgets();
        this.invalidateNodeAttachments();
    }

    protected sanityCheckForMove(): void {
        this.validateBoundsInView();
        this.ensureTextInBounds(true);
        this.validateMinimumBounds();
        this.ensureInsetsInBounds();
    }

    private ensureInsetsInBounds(): void {
        if (isUndef(this.bounds) || isUndef(this.insets) || this.insets!.isEmpty()) {
            return;
        }
        // Make sure the position of insets is inside bounds
        if (this.insets!.x < this.bounds!.x) {
            this.insets!.x = this.bounds!.x;
        } else if (this.insets!.x > this.bounds!.x + this.bounds!.width) {
            this.insets!.x = this.bounds!.x + this.bounds!.width;
        }
        if (this.insets!.y < this.bounds!.y) {
            this.insets!.y = this.bounds!.y;
        } else if (this.insets!.y > this.bounds!.y + this.bounds!.height) {
            this.insets!.y = this.bounds!.y + this.bounds!.height;
        }
        // Make sure the width and height of insets are not bigger than bounds
        if (this.insets!.width + this.insets!.x > this.bounds!.width + this.bounds!.x) {
            this.insets!.width = this.bounds!.width + this.bounds!.x - this.insets!.x;
        }
        if (this.insets!.height + this.insets!.y > this.bounds!.height + this.bounds!.y) {
            this.insets!.height = this.bounds!.height + this.bounds!.y - this.insets!.y;
        }
    }

    public override invalidateBounds(): void {
        // No need
    }

    /**
     * To block any actions.
     */
    protected override resetLinkWidgetPositions(): void {
        // Just block it.
    }

    /**
     * Change the default behavior. If the whole bounds of this compartment is covered
     * by the selection rectangle, this compartment will be selected. Otherwise, it is
     * not even by a touch or its position (the central point) is contained by the selection
     * rectangle.
     *
     * @param rect Rectangle object representing the selection area
     */
    public override select(rect: Rectangle): void {
        if (!isUndef(this.bounds)) {
            this.isSelected = rect.containsRectangle(this.bounds!);
        }
    }

    public override setTextPosition(x: number, y: number): void {
        if (isUndef(this.textBounds!))
            this.textBounds! = new Rectangle(x, y, 0, 0);
        this.blockTextPositionFromBoundsCall = true;
    }

    protected override setTextPositionFromBounds(): void {
        if (this.blockTextPositionFromBoundsCall)
            return;
        super.setTextPositionFromBounds();
    }
}
