import { Rectangle } from './Rectangle';
import { Point } from './Point';
import { Graphics } from './Graphics';
import { Maybe, isUndef } from './Utils';

/**
 * This abstract class is used to describe information about Node states (open, close, active) or
 * sequence features (Tyr phosphorylation).
 */
export abstract class NodeAttachment {
    // Used to map instance stored in the database
    private reactomeId: Maybe<number>;
    // position related to the bounds of the containing node
    // the reference point is the up-left corner of the bounds
    public relativeX: Maybe<number>;
    public relativeY: Maybe<number>;
    // Used to check is this node is selected
    private isSelected: boolean = false;
    // bounds
    private bounds: Maybe<Rectangle>;
    // A flag indicate that bounds should be recalculated
    private isBoundsWrong: boolean = true;
    // Used as a padding between the bounds and text labels
    protected textPadding: number = 2;
    // Used to track if two NodeAttachment is the same
    protected trackId: Maybe<number>;
    // Check if an attachment is editable
    private isEditable: boolean = true;

    constructor() {
    }

    public setReactomeId(id: number): void {
        this.reactomeId = id;
    }

    public getReactomeId(): Maybe<number> {
        return this.reactomeId;
    }

    public setIsEditable(isEditable: boolean): void {
        this.isEditable = isEditable;
    }

    public getIsEditable(): boolean {
        return this.isEditable;
    }

    public setIsSelected(selected: boolean): void {
        this.isSelected = selected;
    }

    public getIsSelected(): boolean {
        return this.isSelected;
    }

    public getBounds(): Maybe<Rectangle> {
        return this.bounds;
    }

    public invalidateBounds(): void {
        this.isBoundsWrong = true;
    }

    /**
     * Set the relative position of this NodeAttachment object.
     * The reference point of the containing Node's bounds' up-left
     * corner.
     *
     * @param relativeX Value for the relative X-axis position
     * @param relativeY Value for the relative Y-axis position
     */
    public setRelativePosition(relativeX: number, relativeY: number): void {
        this.relativeX = relativeX;
        this.relativeY = relativeY;
        this.isBoundsWrong = true;
    }

    public getRelativeX(): Maybe<number> {
        return this.relativeX;
    }

    public getRelativeY(): Maybe<number> {
        return this.relativeY;
    }

    public move(dx: number, dy: number, nodeBounds: Rectangle): void {
        if (isUndef(this.bounds)) {
          return;
        }

        // Find the original position
        let x: number = this.bounds!.x + this.bounds!.width / 2;
        let y: number = this.bounds!.y + this.bounds!.height / 2;
        let dx1: number = Math.abs(x - nodeBounds.x);
        let dx2: number = Math.abs(x - nodeBounds.x - nodeBounds.width);
        let dy1: number = Math.abs(y - nodeBounds.y);
        let dy2: number = Math.abs(y - nodeBounds.y - nodeBounds.height);
        if ((dx1 <= 1 || dx2 <= 1) && dy != 0) { // Have to make some changes. Otherwise, it will stuck
            // Try to change the y
            this.bounds!.y += dy;
            if (this.bounds!.getCenterY() < nodeBounds.y) {
                this.bounds!.y = Math.floor(nodeBounds.y - this.bounds!.getHeight() / 2.0);
            } else if (this.bounds!.getCenterY() > nodeBounds.getMaxY()) {
                this.bounds!.y = Math.floor(nodeBounds.getMaxY() - this.bounds!.getHeight() / 2.0);
            }
        } else if ((dy1 <= 1 || dy2 <= 1) && dx != 0) {
            // Try to change the x
            this.bounds!.x += dx;
            if (this.bounds!.getCenterX() < nodeBounds.x) {
                this.bounds!.x = Math.floor(nodeBounds.x - this.bounds!.getWidth() / 2.0);
            } else if (this.bounds!.getCenterX() > nodeBounds.getMaxX()) {
                this.bounds!.x = Math.floor(nodeBounds.getMaxX() - this.bounds!.getWidth() / 2);
            }
        }
        this.extractRelativePositionFromBounds(nodeBounds);
    }

    private extractRelativePositionFromBounds(nodeBounds: Rectangle): void {
        if (isUndef(this.bounds)) {
          return;
        }
        let x: number = this.bounds!.getCenterX();
        let y: number = this.bounds!.getCenterY();
        this.relativeX = (x - nodeBounds.x) / nodeBounds.width;
        this.relativeY = (y - nodeBounds.y) / nodeBounds.height;
    }

    public validateBounds(nodeBounds: Rectangle, g: Graphics): void {
    /* TODO: Commented out temporarily as Graphics is just a stub
        if (!this.isBoundsWrong ||
            this.relativeX === undefined || this.relativeY === undefined)
            return;
        // Calculate the position of the bounds
        let x: number = (nodeBounds.x + nodeBounds.width * this.relativeX!);
        let y: number = (nodeBounds.y + nodeBounds.height * this.relativeY!);
        let g2: Graphics2D = g as Graphics2D;
        let font: Font = g2.getFont();
        font = font.deriveFont(font.getSize2D() - 3.0);
        let metrics: FontMetrics = g2.getFontMetrics(font);
        let textBounds: Rectangle2D = metrics.getStringBounds(this.getLabel(), g2);
        let width: number = (textBounds.getWidth() + this.textPadding);
        let height: number = (textBounds.getHeight() + this.textPadding);
        // Make sure the width is at least the same as height to make it
        // look nicer
        if (width < height)
            width = height;
        x -= width / 2;
        y -= height / 2;
        if (this.bounds === undefined)
            this.bounds = new Rectangle(x, y, width, height);
        else {
            this.bounds!.x = x;
            this.bounds!.y = y;
            this.bounds!.width = width;
            this.bounds!.height = height;
        }
        this.isBoundsWrong = false;
        */
    }

    /**
     * Check if this NodeAttachment is picked
     *
     * @param p Point to check
     * @return true if this NodeAttachment has bounds and they contain the point; false otherwise
     */
    public isPicked(p: Point): boolean {
        if (isUndef(this.bounds))
            return false;
        return this.bounds!.contains(p);
    }

    public setTrackId(id: number): void {
        this.trackId = id;
    }

    public getTrackId(): Maybe<number> {
        return this.trackId;
    }

    /**
     * This method is used to duplicate this NodeAttachment object.
     *
     * @return Duplicate of this NodeAttachment object
     */
    public abstract duplicate(): NodeAttachment;

    public abstract setLabel(label: string): void;

    public abstract getDescription(): Maybe<string>;

    public abstract setDescription(description: string): void;

    public abstract getLabel(): Maybe<string>;
}
