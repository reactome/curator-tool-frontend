import { Rectangle } from './Rectangle';
import { Point } from './Point';
import { Graphics } from './Graphics';
import { TextLayout } from './TextLayout';
import { Renderable } from './Renderable';
import { DefaultRenderConstants } from './DefaultRenderConstants';
import { NodeAttachment } from './NodeAttachment';
import { NodeAttachmentAutoLayout } from './NodeAttachmentAutoLayout';
import { NodeConnectInfo } from './NodeConnectInfo';
import { ConnectInfo } from './ConnectInfo';
import { ConnectWidget } from './ConnectWidget';
import { RenderableFeature } from './RenderableFeature';
import { RenderableState } from './RenderableState';
import { RenderableComplex } from './RenderableComplex';
import { HyperEdge } from './HyperEdge';
import { FlowLine } from './FlowLine';
import { Maybe, isUndef } from './Utils';

export class Node extends Renderable {

     static readonly RESIZE_WIDGET_WIDTH: number = 4;
     private static width: number = DefaultRenderConstants.DEFAULT_NODE_WIDTH;
     private static widthRatioOfBoundsToText: number = 1.3;
     private static heightRatioOfBoundsToText: number = 1.5;
     protected static ensureBoundsInView: boolean = true;
     protected boundsBuffer: number = 4;
     private isEditing: boolean = false;
     private textLayouts?: TextLayout[];
     protected components?: Array<Renderable>;
     private stoiBounds?: Rectangle;
     protected linkWidgetPositions?: Point[];
     protected linkPoint?: Point;
     protected duringMoving: boolean = false;
     protected selectionPosition: SelectionPosition = SelectionPosition.NONE;
     protected isLinkable: boolean = true;
     protected isFeatureAddable: boolean = false;
     protected isStateAddable: boolean = false;
     protected attachments?: NodeAttachment[];
     protected isEditable: boolean = true;
     protected isMultimerFormable: boolean = false;
     protected multimerMonomerNumber: number = 0;
     protected shortcuts?: Renderable[];
     protected minWidth: number = 10;
     protected needDashedBorder: boolean = false;
     protected isForDrug: boolean = false;

     constructor(displayName: Maybe<string>) {
         super();
         this.setConnectInfo(new NodeConnectInfo() as ConnectInfo);
         if (!isUndef(displayName)) {
            this.setDisplayName(displayName!);
         }
     }

     public setEnsureBoundsInView(ensure: boolean): void {
         Node.ensureBoundsInView = ensure;
     }

     public setMinWidth(width: number): void {
         this.minWidth = width;
     }

     public getMinWidth(): number {
         return this.minWidth;
     }

     public isNeedDashedBorder(): boolean {
         return this.needDashedBorder;
     }

     public setNeedDashedBorder(needDashedBorder: boolean): void {
         this.needDashedBorder = needDashedBorder;
     }

     /**
      * Return a read-only property.
      *
      * @return true if a multimer can be formed; false otherwise
      */
     public getIsMultimerFormable(): boolean {
         return this.isMultimerFormable;
     }

     public setMultimerMonomerNumber(number: number): void {
         if (!this.isMultimerFormable) {
             throw new Error("Node.setMultimerMonomerNumber(): this type of Node cannot form multimer!");
         }
         this.multimerMonomerNumber = number;
     }

     public getMultimerMonomerNumber(): number {
         return this.multimerMonomerNumber;
     }

     public isPicked(p: Point): boolean {
         // A node should not be picked if it is hidden
         if (isUndef(this.getBounds()) || !this.isVisible) {
             return false;
         }
         if (this.isResizeWidgetPicked(p)) {
             return true;
         }
         if (this.isNodeAttachmentPicked(p)) {
             return true;
         }
         let isSelected: boolean = this.getBounds()!.contains(p);
         if (isSelected) {
             this.selectionPosition = SelectionPosition.NODE;
         }
         return isSelected;
     }

    protected isResizeWidgetPicked(p: Point): boolean {
        // reset
        this.selectionPosition = SelectionPosition.NONE;
        if (isUndef(this.bounds))
            return false;

        // Check if any resize widget is picked
        // north-east
        let resizeWidget: Rectangle = new Rectangle(0,0,0,0);
        resizeWidget.width = 2 * Node.RESIZE_WIDGET_WIDTH;
        resizeWidget.height = 2 * Node.RESIZE_WIDGET_WIDTH;
        resizeWidget.x = this.bounds!.x + this.bounds!.width - Node.RESIZE_WIDGET_WIDTH;
        resizeWidget.y = this.bounds!.y - Node.RESIZE_WIDGET_WIDTH;
        if (resizeWidget.contains(p)) {
            this.selectionPosition = SelectionPosition.NORTH_EAST;
            return true;
        }

        // southeast
        resizeWidget.x = this.bounds!.x + this.bounds!.width - Node.RESIZE_WIDGET_WIDTH;
        resizeWidget.y = this.bounds!.y + this.bounds!.height - Node.RESIZE_WIDGET_WIDTH;
        if (resizeWidget.contains(p)) {
            this.selectionPosition = SelectionPosition.SOUTH_EAST;
            return true;
        }

        // southwest
        resizeWidget.x = this.bounds!.x - Node.RESIZE_WIDGET_WIDTH;
        if (resizeWidget.contains(p)) {
            this.selectionPosition = SelectionPosition.SOUTH_WEST;
            return true;
        }

        // northwest
        resizeWidget.y = this.bounds!.y - Node.RESIZE_WIDGET_WIDTH;
        if (resizeWidget.contains(p)) {
            this.selectionPosition = SelectionPosition.NORTH_WEST;
            return true;
        }

        return false;
    }

    protected isNodeAttachmentPicked(p: Point): boolean {
        // check if and NodeAttachment is selected
        if (!isUndef(this.attachments) && this.attachments!.length > 0) {
            let selected: Maybe<NodeAttachment>;
            for (let attachment of this.attachments!) {
                if (!attachment.getIsEditable())
                    continue;
                if (attachment.isPicked(p)) {
                    attachment.setIsSelected(true);
                    selected = attachment;
                }
                else
                    attachment.setIsSelected(false);
            }
            if (selected instanceof RenderableFeature) {
                this.selectionPosition = SelectionPosition.FEATURE;
                return true;
            }
            else if (selected instanceof RenderableState) {
                this.selectionPosition = SelectionPosition.STATE;
                return true;
            }
        }
        return false;
    }

    protected validateMinimumBounds() {
        if (!isUndef(this.bounds)) {
          if (this.bounds!.width < this.minWidth)
              this.bounds!.width = this.minWidth;
          if (this.bounds!.height < this.minWidth)
              this.bounds!.height = this.minWidth;
        }
    }

    /**
     * Move this Renderable with a specified distance.
     *
     * @param dx Value to move along the x-axis
     * @param dy Value to move along the y-axis
     */
    public move(dx: number, dy: number): void {
        if (isUndef(this.bounds)) {
            return;
        }
        this.duringMoving = false;
        switch (this.selectionPosition) {
            // Do resizing
            case SelectionPosition.NORTH_EAST:
                // Make sure the minimum size
                this.bounds!.width += dx;
                this.bounds!.height -= dy;
                this.bounds!.y += dy;
                this.validateMinimumBounds();
                this.validateBoundsInView();
                break;
            case SelectionPosition.SOUTH_EAST:
                this.bounds!.width += dx;
                this.bounds!.height += dy;
                this.validateMinimumBounds();
                this.validateBoundsInView();
                break;
            case SelectionPosition.SOUTH_WEST:
                this.bounds!.width -= dx;
                this.bounds!.height += dy;
                this.bounds!.x += dx;
                this.validateMinimumBounds();
                this.validateBoundsInView();
                break;
            case SelectionPosition.NORTH_WEST:
                this.bounds!.width -= dx;
                this.bounds!.height -= dy;
                this.bounds!.x += dx;
                this.bounds!.y += dy;
                this.validateMinimumBounds();
                this.validateBoundsInView();
                break;
            // for node feature
            case SelectionPosition.FEATURE: case SelectionPosition.STATE:
                this.moveNodeAttachment(dx, dy);
                break;
            // Treat as line for default
            default:
                this.bounds!.x += dx;
                this.bounds!.y += dy;
                this.duringMoving = true;
                this.validateBoundsInView();
                break;
        }
        this.validatePositionFromBounds();
        // Cannot move widgets to catch up the node's moving.
        // calculation is not fast enough.
        this.invalidateConnectWidgets();
        // Call this method instead just setting the flag
        //invalidateBounds();
        this.invalidateTextBounds();
        this.invalidateNodeAttachments();
    }

    /**
     * Make sure this node is in the view if the validation is enabled and the bounds are outside the top of left side
     * padding
     */
    protected validateBoundsInView(): void {
        if (!Node.ensureBoundsInView || isUndef(this.bounds))
            return;
        if (this.bounds!.x < this.pad)
            this.bounds!.x = this.pad;
        if (this.bounds!.y < this.pad)
            this.bounds!.y = this.pad;
    }

    protected moveNodeAttachment(dx: number, dy: number): void {
        if (isUndef(this.attachments)|| isUndef(this.bounds)) {
           return;
        }
        // Find which one is picked
        for (const attachment of this.attachments!) {
            if (attachment.getIsSelected()) {
                attachment.move(dx, dy, this.bounds!);
                return;
            }
        }
    }

    public invalidateNodeAttachments(): void {
        if (!isUndef(this.attachments) && this.attachments!.length > 0) {
            for (const attachment of this.attachments!)
                attachment.invalidateBounds();
        }
    }

    /**
     * Flag to show text bounds should be re-calculated.
     */
    public invalidateTextBounds(): void {
        this.needCheckTextBounds = true;
    }

    protected validatePositionFromBounds(): void {
        if (!isUndef(this.position) && !isUndef(this.bounds)) {
          this.position!.x = Math.round(this.bounds!.getCenterX());
          this.position!.y = Math.round(this.bounds!.getCenterY());
        }
    }

    public override setPosition(p: Point): void {
        this.position = p;
        this.invalidateConnectWidgets();
        this.needCheckBounds = true;
    }

    /**
     * This method is used to validate text bounds for nodes that can display
     * texts. This method should be called when the bounds of the node changes
     * resulting from resizing.
     *
     * @param g Graphics object for which to validate text
     */
    protected validateTextBounds(g: Graphics): void {
        this.validateTextSize(g);
        this.setTextPositionFromBounds();
    }

    /**
     * Recalculate the bounds.
     * TODO: Bounds and text bounds calculation should be handled by renderer in the future
     * since they should be involved in the rendering process.
     *
     * @param g Graphics object for which to validate bounds
     */
    public validateBounds(g: Graphics): void {
    /* TODO: Commented out temporarily as Graphics is just a stub
        // Have to make sure there is bounds available
        if (this.bounds === null) {
            this.bounds = new Rectangle(0,0,0,0);
            this.initBounds(g); // Get bounds from text as the minimum
        }
        // Have to set to the original transform. Otherwise
        // the first validateTextBounds() works not correctly
        // Use unscaled Graphics
        let g2: Graphics2D = g as Graphics2D;
        // Have to use non-transform Graphics context
        let originalAT: AffineTransform = g2.getTransform();
        try {
            g2.transform(originalAT.createInverse());
        }
        catch(NoninvertibleTransformException e) {
            console.error("Node.valiateBounds(): " + e);
        }
        if (this.textBounds === null || this.textBounds.isEmpty()) {
            this.validateTextBounds(g);
        }
        // Have to make sure the text is there
        if (!this.needCheckBounds && !this.needCheckTextBounds) {
            g2.setTransform(originalAT);
            return;
        }
        // Only text bounds need to be checking
        if (this.needCheckTextBounds) {
            this.validateTextBounds(g);
            this.resetLinkWidgetPositions();
            g2.transform(originalAT);
            this.needCheckTextBounds = false;
            return;
        }
        if (!this.needCheckBounds)
            return;
        this.needCheckBounds = false;
        g2.transform(originalAT);
        // calculate link widgets
        this.resetLinkWidgetPositions();
        // default behaviors
        this.setTextPositionFromBounds();
        */
    }

    protected initBounds(g: Graphics): void {
        if (isUndef(this.textBounds) || isUndef(this.bounds) || isUndef(this.position)) {
            return;
        }

        this.validateTextSize(g);

        // Want to make the bounds larger
        let w: number = Math.floor(this.textBounds!.width * Node.widthRatioOfBoundsToText) + 1; // Give some extra pixels for double to integer conversion
        if (w < this.minWidth) { // Make sure it takes minum width for layout in a pathway diagram purpose
            w = this.minWidth;
        }
        let h: number = Math.floor(this.textBounds!.height * Node.heightRatioOfBoundsToText) + 1;

        this.bounds!.x = this.position!.x - w / 2;
        this.bounds!.y = this.position!.y - h / 2;
        this.bounds!.width = w;
        this.bounds!.height = h;
    }

    protected validateTextSize(g: Graphics): void {
        let tmpName: string = this.getDisplayName() || "...";
        if (tmpName.length === 0) {
            tmpName = " "; // For an empty Strings
        }
        this.validateTextSizeMain(g, tmpName);
    }

    protected validateTextSizeMain(g: Graphics, tmpName: string): void {
        this.splitName(tmpName, g);

        // Get width and height from text layouts
        let w: number = 0.0;
        let h: number = 0.0;

        if (!isUndef(this.textLayouts)) {
            for (let layout of this.textLayouts!) {
                if (w < layout.getAdvance()) {
                    w = layout.getAdvance();
                }
                h += (layout.getAscent() + layout.getDescent() + layout.getLeading());
            }
        }

        w += (2 * this.boundsBuffer);
        h += (2 * this.boundsBuffer);

        if (isUndef(this.textBounds)) {
            this.textBounds = new Rectangle(0,0,0,0);
        }

        this.textBounds!.width = Math.floor(w);
        this.textBounds!.height = Math.floor(h);
    }

    /**
     * Check if the wrapped text in a Node is overflowed.
     *
     * @return true if text overflows boundaries; false otherwise
     */
    public isTextOverflowed(): boolean {
        if (isUndef(this.bounds) || isUndef(this.textBounds))
            return false; // Cannot determine
        // A minimum rectangle
        if (this.bounds!.getWidth() < this.textBounds!.getWidth() - 2 * this.boundsBuffer) // Minimum requirement
            return true;
        if (this.bounds!.getHeight() < this.textBounds!.getHeight() - 2 * this.boundsBuffer)
            return true;
        return false;
    }

    protected resetLinkWidgetPositions(): void {
        if (!this.isLinkable || isUndef(this.bounds))
            return;
        if (isUndef(this.linkWidgetPositions)) {
            this.linkWidgetPositions = [];
        }
        // East
        let x = this.bounds!.x + this.bounds!.width;
        let y = this.bounds!.y + this.bounds!.height / 2;
        this.linkWidgetPositions!.push(new Point(x, y));
        // South
        x = this.bounds!.x + this.bounds!.width / 2;
        y = this.bounds!.y + this.bounds!.height;
        this.linkWidgetPositions!.push(new Point(x, y));
        // West
        x = this.bounds!.x;
        y = this.bounds!.y + this.bounds!.height / 2;
        this.linkWidgetPositions!.push(new Point(x, y));
        // North
        x = this.bounds!.x + this.bounds!.width / 2;
        y = this.bounds!.y;
        this.linkWidgetPositions!.push(new Point(x, y));
    }

    private splitName(name: string, g: Graphics): void {
    /* TODO: Commented out temporarily as g: Graphics is just a stub
        if (this.duringMoving && this.textLayouts !== null) {
            this.duringMoving = false;
            return;
        }

        let g2: Graphics2D = g as Graphics2D;
        let attributes: Map<string, any> = new Map();
        attributes.set(TextAttribute.FONT, g.getFont());
        let as: AttributedString = new AttributedString(name, attributes);
        let aci: AttributedCharacterIterator = as.getIterator();
        let context: FontRenderContext = g2.getFontRenderContext();
        let lbm: LineBreakMeasurer = new LineBreakMeasurer(aci, context);

        if (textLayouts === null) {
            textLayouts = new Array<TextLayout>();
        } else {
            textLayouts.clear();
        }

        let end: number = aci.getEndIndex();
        let width: number;

        if (bounds === null || bounds.width === 0) {
            if (Node.width < minWidth) {
                width = minWidth;
            } else {
                width = Node.width;
            }
        } else {
            width = bounds.width;
        }

        while (lbm.getPosition() < end) {
            let layout: TextLayout = lbm.nextLayout(width - 2 * boundsBuffer);
            textLayouts.push(layout);
        }
        */
    }

    /**
     * Return if the bounds is correct.
     *
     * @return true if boundaries are validated; false otherwise
     */
    public isBoundsValidate(): boolean {
        return !this.needCheckBounds;
    }


    /*
     * @see Renderable#setDisplayName(string)
     */
    public override setDisplayName(name: string): void {
        super.setDisplayName(name);
        if (isUndef(this.bounds)) { // For newly create Node
            this.invalidateBounds();
        } else {
            this.invalidateTextBounds();
        }
        this.invalidateConnectWidgets();
        const shortcuts: Maybe<Renderable[]> = this.getShortcuts();
        if (isUndef(shortcuts)) {
            return;
        }
        for (let r of shortcuts!) {
            const shortcut: Node = r as Node;
            if (r === this) {
                continue;
            }
            if (isUndef(shortcut.getBounds())) {
                shortcut.invalidateBounds();
            } else {
                shortcut.invalidateTextBounds();
            }
            shortcut.invalidateConnectWidgets();
        }
    }

    getConnectedReactions(): HyperEdge[] {
        const reactions: HyperEdge[] = [];
        if (!isUndef(this.connectInfo)) {
            const widgets = this.connectInfo!.getConnectWidgets();
            if (!isUndef(widgets) && widgets!.length > 0) {
                for (const widget of widgets!) {
                    if (!isUndef(widget.getEdge())) {
                        const edge = widget.getEdge();
                        if (!isUndef(edge) && !reactions.includes(edge!)) {
                            reactions.push(edge!);
                        }
                    }
                }
            }
        }
        return reactions;
    }

    public override removeShortcut(shortcut: Renderable): void {
        if (!isUndef(this.shortcuts)) {
            const index = this.shortcuts!.indexOf(shortcut);
            if (index > -1) {
                this.shortcuts!.splice(index, 1);
            }
        }
    }

    public override getShortcuts(): Maybe<Renderable[]> {
        return this.shortcuts;
    }

    public override setShortcuts(shortcuts: Renderable[]): void {
        this.shortcuts = shortcuts;
    }

    setIsEditing(editing: boolean): void {
        this.isEditing = editing;
    }

    getIsEditing(): boolean {
        return this.isEditing;
    }

    getIsEditable(): boolean {
        return this.isEditable;
    }

    getTextLayouts(): Maybe<TextLayout[]> {
        return this.textLayouts;
    }

    static setNodeWidth(w: number): void {
        this.width = w;
    }

    static getNodeWidth(): number {
        return this.width;
    }

    /**
     * Set the ratio of the width of the Node bounds to the wrapped text.
     *
     * @param ratio Ratio value of Node width to text width
     */
    public static setWidthRatioOfBoundsToText(ratio: number): void {
        Node.widthRatioOfBoundsToText = ratio;
    }

    public static getWidthRatioOfBoundsToText(): number {
        return Node.widthRatioOfBoundsToText;
    }

    /**
     * Set the ratio of the height of the Node bounds to the wrapped text.
     *
     * @param ratio Ratio value of Node height to text height
     */
    public static setHeightRatioOfBoundsToText(ratio: number): void {
        Node.heightRatioOfBoundsToText = ratio;
    }

    public static getHeightRatioOfBoundsToText(): number {
        return Node.heightRatioOfBoundsToText;
    }

    /**
     * To support serialization.
     *
     * @param in ObjectInputStream from which to read the object
     * @throws IOException Thrown in an IO error occurs attempting to read
     * @throws ClassNotFoundException Thrown if the class of a serialized object can not be found
     */
// TODO
//     private readObject(in: java.io.ObjectInputStream): void {
//         in.defaultReadObject();
//         this.invalidateBounds();
//     }

    public getComponents(): Maybe<Renderable[]> {
        return this.components;
    }

    public override addComponent(renderable: Maybe<Renderable>): void {
        if (isUndef(renderable)) {
          return;
        }
        if (isUndef(this.components))
            this.components = [];
        this.components!.push(renderable!);
    }

    public override getComponentByName(name: string): Maybe<Renderable> {
        if (isUndef(this.components) || this.components!.length == 0)
            return undefined;
        let renderable: Maybe<Renderable>;
        for (let renderable of this.components!) {
            if (renderable instanceof FlowLine)
                continue; // A flow line has null name
            if (renderable.getDisplayName() === name)
                return renderable;
        }
        return undefined;
    }

    public override getComponentByID(id: number): Maybe<Renderable> {
        if (isUndef(this.components)|| this.components!.length === 0) {
            return undefined;
        }
        for (let renderable of this.components!) {
            if (renderable.getID() === id) {
                return renderable;
            }
        }
        return undefined;
    }

    setStoiBounds(rect: Rectangle): void {
        this.stoiBounds = rect;
    }

    getStoiBounds(): Maybe<Rectangle> {
        return this.stoiBounds;
    }

    getType(): string {
        return "Node";
    }

    /**
     * A four element Point list: East, South, West and North.
     *
     * @return List of link widget positions
     */
    getLinkWidgetPositions(): Maybe<Point[]> {
        return this.linkWidgetPositions;
    }

    getLinkPoint(): Maybe<Point> {
        return this.position;
    }

    protected setTextPositionFromBounds(): void {
        if (isUndef(this.bounds)) {
            return; // Wait for bounds is setting.
        }
        if (isUndef(this.textBounds)) {
            let r: Rectangle = this.bounds!;
            this.textBounds = new Rectangle(r.x, r.y, r.width, r.height);
        }
        else {
            this.textBounds!.x = this.bounds!.x + (this.bounds!.width - this.textBounds!.width) / 2;
            this.textBounds!.y = this.bounds!.y + (this.bounds!.height - this.textBounds!.height) / 2;
        }
    }

    public validateConnectWidget(widget: ConnectWidget): void {
    /* Commented out temporarily due to lack of Line2D
        let r: rectangle = this.bounds();
        let bounds: Rectangle = new Rectangle(r.x, r.y, r.width, r.height);
        if (this.stoiBounds !== undefined) {
            bounds = bounds.union(this.stoiBounds); // A new bounds is created.
        }
        let linkPoint: Point = undefined;
        if (widget.getRole() == HyperEdge.INPUT) {
            linkPoint = this.getLinkPoint();
        } else {
            linkPoint = this.getPosition();
        }
        let x0: number = linkPoint.x;
        let y0: number = linkPoint.y;
        let controlPoint: Point = widget.getControlPoint();
        let ratio: number = (controlPoint.y - y0) / (controlPoint.x - x0);
        let x1: number = bounds.x;
        let y1: number = bounds.y;
        let x2: number = bounds.x + bounds.width;
        let y2: number = y1;
        let point: Point = widget.getPoint();

        // Check north
        if (Line2D.linesIntersect(controlPoint.x, controlPoint.y, x0, y0, x1, y1, x2, y2)) {
            point.x = (x0 - 1 / ratio * bounds.height / 2);
            point.y = bounds.y - ConnectWidget.BUFFER;
            if (point.y == controlPoint.y) {
                point.y = bounds.y;
            }
            return;
        }

        // Check east
        x1 = x2;
        y1 = bounds.y + bounds.height;
        if (Line2D.linesIntersect(controlPoint.x, controlPoint.y, x0, y0, x1, y1, x2, y2)) {
            point.x = x1 + ConnectWidget.BUFFER;
            if (point.x == controlPoint.x) {
                point.x = x1;
            }
            point.y = (y0 + ratio * bounds.width / 2);
            return;
        }

        // Check south
        x2 = bounds.x;
        y2 = y1;
        if (Line2D.linesIntersect(controlPoint.x, controlPoint.y, x0, y0, x1, y1, x2, y2)) {
            point.x = (x0 + 1 / ratio * bounds.height / 2);
            point.y = y2 + ConnectWidget.BUFFER;
            if (point.y == controlPoint.y) {
                point.y = y2;
            }
            return;
        }

        // Check west
        x1 = x2;
        y1 = bounds.y;
        if (Line2D.linesIntersect(controlPoint.x, controlPoint.y, x0, y0, x1, y1, x2, y2)) {
            point.x = x1 - ConnectWidget.BUFFER;
            if (point.x == controlPoint.x) {
                point.x = x1;
            }
            point.y = (y0 - ratio * bounds.width / 2);
            return;
        }

        // ControlPoint might be in the lines of bounds or in the
        // bounds.
        if ((controlPoint.x > x0) && (controlPoint.y < y0)) {
            point.x = bounds.x + bounds.width;
            point.y = controlPoint.y;
        }
        else if ((controlPoint.x > x0) && (controlPoint.y > y0)) {
            point.x = controlPoint.x;
            point.y = bounds.y + bounds.height;
        }
        else if ((controlPoint.x < x0) && (controlPoint.y > y0)) {
            point.x = bounds.x;
            point.y = controlPoint.y;
        }
        else if ((controlPoint.x < x0) && (controlPoint.y < y0)) {
            point.x = controlPoint.x;
            point.y = bounds.y;
        }
        else {
            // Choose a default point
            point.x = bounds.x;
            point.y = bounds.y;
        }
        */
    }

    public override setContainer(renderable: Renderable): void {
        super.setContainer(renderable);
        // A complex component cannot be used to link to other node.
        if (renderable instanceof RenderableComplex) {
            if (!isUndef(this.linkWidgetPositions))
                this.linkWidgetPositions = undefined;
        }
        else // in cases a node is moved out of a complex
            this.resetLinkWidgetPositions();
    }

    public override generateShortcut(): Maybe<Renderable> {
        // If a subclass calls this method, the class name should
        // be the subclass
        const node: Node = new Node(undefined);
        this.generateShortcutMain(node);
        return node;
    }

    protected generateShortcutMain(shortcut: Node): void {
        // Make all attributes copy to this target
        shortcut.attributes = this.attributes;
        // Need to duplicate NodeAttachments if any
        if (!isUndef(this.attachments)) {
            const copy: NodeAttachment[] = [];
            for (const attachment of this.attachments!) {
                const tmp: NodeAttachment = attachment.duplicate();
                copy.push(tmp);
            }
            shortcut.attachments = copy;
        }
        // Use the same renderer
        shortcut.renderer = this.renderer;
        // Copy position info
        if (!isUndef(this.getPosition())) {
            const p: Point = new Point(this.getPosition()!.x + 20, this.getPosition()!.y + 20);
            shortcut.setPosition(p);
        }
        if (!isUndef(this.getBackgroundColor())) {
            shortcut.setBackgroundColor(this.getBackgroundColor()!);
        }
        if (!isUndef(this.getForegroundColor())) {
            shortcut.setForegroundColor(this.getForegroundColor()!);
        }
        shortcut.setIsForDisease(this.getIsForDisease());
        shortcut.setIsForDrug(this.getIsForDrug());
        if (this.isMultimerFormable)
            shortcut.setMultimerMonomerNumber(this.multimerMonomerNumber);
        // use an original bounds
        if (!isUndef(this.bounds)) {
            let r: Rectangle = this.bounds!;
            shortcut.bounds = new Rectangle(r.x, r.y, r.width, r.height);
        }
        shortcut.invalidateBounds();
        if (isUndef(this.shortcuts)) {
            this.shortcuts = [];
            this.shortcuts.push(this);
        }
        // Copy reactomeId if any. However, two shortcuts can have different
        // reactome id (e.g. in different compartments).
        shortcut.setReactomeId(this.getReactomeId());
        shortcut.isVisible = this.isVisible;
        this.shortcuts!.push(shortcut);
        shortcut.shortcuts = this.shortcuts;
    }

    /**
     * Set if a RenderableFeature can be attached to this Node object.
     *
     * @param isAddable True if a RenderableFeature can be attached; false otherwise
     */
    public setIsFeatureAddable(isAddable: boolean): void {
        this.isFeatureAddable = isAddable;
    }

    /**
     * Check if a RenderableFeature can be attached to this Node object.
     *
     * @return true if a RenderableFeature can be attached; false otherwise
     */
    public getIsFeatureAddable(): boolean {
        return this.isFeatureAddable;
    }

    /**
     * Add a RenderableFeature to this Node object.
     *
     * @param feature RenderableFeature object to add
     */
    public addFeature(feature: RenderableFeature): void {
        // Have to make sure a RenderableFeature can be added to this Node.
        if (!this.isFeatureAddable) {
            return;
        }
        this.addNodeAttachment(feature as unknown as NodeAttachment);
    }

    /**
     * Add a feature to this Node only. If this Node has other shortcuts,
     * the added feature will not be propagated to other Nodes.
     *
     * @param feature RenderableFeature object to add
     */
    public addFeatureLocally(feature: RenderableFeature): void {
        if (!this.isFeatureAddable) {
            return;
        }
        this.addNodeAttachmentLocally(feature as unknown as NodeAttachment);
    }

    /**
     * The values set in this method will not be popped up to shortcuts if this is
     * a target or to target or other shortcuts if this is a shortcut. This method is
     * basically used to do a simple setting.
     *
     * @param attachments List of NodeAttachment objects to set for this node
     */
    public setNodeAttachmentsLocally(attachments: Array<NodeAttachment>): void {
        this.attachments = attachments;
    }

    public layoutNodeAttachments(): void {
        if (isUndef(this.attachments) || this.attachments!.length == 0 || isUndef(this.getBounds())) {
            return;
        }
        const layout: NodeAttachmentAutoLayout = new NodeAttachmentAutoLayout();
        layout.layout(this.attachments!,
                      this.getBounds()!.width,
                      this.getBounds()!.height);
    }

    /**
     * Remove the selected NodeAttachment.
     *
     * @return true if there is a selected attachment and it is removed; false otherwise
     */
    public removeSelectedAttachment(): boolean {
        // Find the selected feature index
        let selectedId: Maybe<number> = -1;
        let rtn: boolean = false;
        if (!isUndef(this.attachments)) {
            for (let attachment of this.attachments!) {
                if (attachment.getIsSelected()) {
                    selectedId = attachment.getTrackId();
                    break;
                }
            }
        }
        // Nothing to delete
        if (isUndef(selectedId) || selectedId! == -1)
            return false;
        // Need to check shortcuts
        // TODO: Commented out due to lack of RenderUtility
        // let target: Node = RenderUtility.getShortcutTarget(this);
        let target: Node = new Node(undefined); // TODO: Temporary replacement to make Typescript compile
        // Target and shortcuts may have different settings of features and states
        if (!isUndef(target.attachments)) {
            target.attachments = target.attachments!.filter(att => att.getTrackId() === selectedId);
        }
        if (!isUndef(target.getShortcuts())) {
            for (let shortcut of target.getShortcuts()!) {
                let shortcutNode = shortcut as Node;
                if (isUndef(shortcutNode.attachments)|| shortcutNode.attachments!.length === 0)
                    continue;
                shortcutNode.attachments! = shortcutNode.attachments!.filter(att => att.getTrackId() === selectedId);
            }
        }
        return true;
    }

    /**
     * Remove the selected NodeAttachment in this Node only. Other shortcuts to this
     * Node should still keep the selected node.
     *
     * @return true if there is a selected attachment and it is removed; false otherwise
     */
    public removeSelectedAttachmentLocally(): boolean {
        let removed: boolean = false;
        if (!isUndef(this.attachments)) {
            let newAttachments = this.attachments!.filter(att => att.getIsSelected());
            if (newAttachments.length < this.attachments!.length) {
                removed = true;
            }
            this.attachments! = newAttachments;
        }
        return removed;
    }

    public removeNodeAttachment(attachment: NodeAttachment): void {
        if (!isUndef(this.attachments)) {
            this.attachments! = this.attachments!.filter(att => att === attachment);
        }
    }

    /**
     * Return the selection position of this Node object.
     *
     * @return one of values in enum SelectionPosition
     */
    public getSelectionPosition(): SelectionPosition {
        return this.selectionPosition;
    }

    public setSelectionPosition(pos: SelectionPosition): void {
        this.selectionPosition = pos;
    }

    public setIsStateAddable(isAddable: boolean): void {
        this.isStateAddable = isAddable;
    }

    public getIsStateAddable(): boolean {
        return this.isStateAddable;
    }

    public addState(state: RenderableState): void {
        if (!this.isStateAddable)
            return;
        this.addNodeAttachment(state as unknown as NodeAttachment);
    }

    /**
     * Add a RenderbleState to this Node object only (if this node has a state set as addable). Any shortcuts to this
     * Node will not get the passed RenderableState object.
     *
     * @param state RenderableState to add to this object
     */
    public addStateLocally(state: RenderableState): void {
        if (!this.isStateAddable) {
            return;
        }
        this.addNodeAttachmentLocally(state as unknown as NodeAttachment);
    }

    /**
     * Use a method to add NodeAttachment esp to handle shortcuts.
     *
     * @param attachment NodeAttachment object to add
     */
    private addNodeAttachment(attachment: NodeAttachment): void {
        let trackId: number = this.generateUniqueAttachmentId();
        attachment.setTrackId(trackId);
        // TODO: Commented out due to lack of RenderUtility
        // let target: Node = RenderUtility.getShortcutTarget(this);
        let target: Node = new Node(undefined); // TODO: Temporary replacement to make Typescript compile

        if (isUndef(target.attachments)) {
            target.attachments = new Array<NodeAttachment>();
        }
        target.attachments!.push(attachment);
        // Need to handle shortcuts
        let shortcuts: Maybe<Renderable[]> = this.getShortcuts();
        if (!isUndef(shortcuts)) {
            for (let r of shortcuts!) {
                if (r === this) {
                    continue;
                }
                let node: Node = r as Node;
                if (isUndef(node.attachments)) {
                    node.attachments = new Array<NodeAttachment>();
                }
                node.attachments!.push(attachment.duplicate());
            }
        }
    }

    /**
     * Search all NodeAttachments attached to the target and its shortcuts to
     * find the maximum id and return one more than that maximum id
     *
     * @return One more than the maximum id of NodeAttachments attached to the target or shortcuts or
     * zero if there are no attached NodeAttachments
     */
    private generateUniqueAttachmentId(): number {
        // TODO: Commented out due to lack of RenderUtility
        // let target: Node = RenderUtility.getShortcutTarget(this);
        let target: Node = new Node(undefined); // TODO: Temporary replacement to make Typescript compile

        let max: number = -1; // The minimum should be 0
        if (!isUndef(target.attachments)) {
            for (let attachment of target.attachments!) {
                if (!isUndef(attachment.getTrackId()) && attachment.getTrackId()! > max) {
                    max = attachment.getTrackId()!;
                }
            }
        }
        let shortcuts: Maybe<Renderable[]> = target.getShortcuts();
        if (!isUndef(shortcuts) && shortcuts!.length > 0) {
            for (let r of shortcuts!) {
                let node = r as Node;
                if (!isUndef(node.attachments)) {
                    for (let attachment of node.attachments!) {
                        if (!isUndef(attachment.getTrackId()) && attachment.getTrackId()! > max) {
                            max = attachment.getTrackId()!;
                        }
                    }
                }
            }
        }
        max ++;
        return max;
    }

    /**
     * A helper method to add a NodeAttachment to this Node only.
     *
     * @param attachment NodeAttachment to add to this node
     */
    private addNodeAttachmentLocally(attachment: NodeAttachment): void {
        const trackId: number = this.generateUniqueAttachmentId();
        attachment.setTrackId(trackId);
        if (!this.attachments) {
            this.attachments = [];
        }
        this.attachments.push(attachment);
    }

    public getNodeAttachments(): Maybe<NodeAttachment[]> {
        return this.attachments;
    }

    public setIsForDrug(isForDrug: boolean): void {
        this.isForDrug = isForDrug;
    }

    public getIsForDrug(): boolean {
        return this.isForDrug;
    }
}

export enum SelectionPosition {
     // north east corner
     NORTH_EAST,
     // south east corner
     SOUTH_EAST,
     // south west corner
     SOUTH_WEST,
     // north west corner
     NORTH_WEST,
     // inside north east corner
     IN_NORTH_EAST,
     // inside south east corner
     IN_SOUTH_EAST,
     // inside south west corner
     IN_SOUTH_WEST,
     // inside north west corner
     IN_NORTH_WEST,
     // nothing is selected
     NONE,
     // the whole node is selected
     NODE,
     // The text label is selected
     TEXT,
     // A contained child Node (e.g. complex component) is selected
     CHILD_NODE,
     // A RenderableFeature is selected
     FEATURE,
     // A RenderableState is selected
     STATE
}


