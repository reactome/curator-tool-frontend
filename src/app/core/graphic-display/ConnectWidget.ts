import { Point } from './Point';
import { HyperEdge } from './HyperEdge';
import { Rectangle } from './Rectangle';
import { Node } from './Node';
import { Maybe, isUndef } from './Utils';

export class ConnectWidget {
     public static BUFFER: number = 3;
     private point: Point; // connecting point
     private controlPoint?: Point; // Another point that decide the line segement with point.
     private role: number; // one of input, output, and helper
     private index: number; // index of inputs, outputs or helpers.
     private stoichiometry: number = 1; // default
     private connectedNode?: Node;
     private edge?: HyperEdge;
     private invalidate: boolean = false; // A flag to set if new connection position should be calculated
     private ratio: number = 0; // a ratio to keep track fixed position

     /** Creates a new instance of AttachWidget
      *
      * @param p Connecting point
      * @param controlP Another point that decides the line segment with the connecting point
      * @param role One of input, output, or helper
      * @param index Index of inputs, outputs, or helpers
      */
     constructor(p: Point, controlP: Maybe<Point>, role: number, index: number) {
         this.point = p;
         this.controlPoint = controlP;
         this.role = role;
         this.index = index;
     }

     /**
      * Create a ConnectWidget with the same rendering information but not linking to
      * nodes and edges.
      *
      * @return Copy of this ConnectWidget object
      */
     shallowCopy(): ConnectWidget {
         let clone: ConnectWidget = new ConnectWidget(new Point(this.point.x, this.point.y),
                                                      new Point(this.controlPoint!.x, this.controlPoint!.y),
                                                      this.role,
                                                      this.index);
         clone.stoichiometry = this.stoichiometry;
         clone.connectedNode = this.connectedNode;
         clone.ratio = this.ratio;
         return clone;
     }

    public getPoint(): Point {
        return this.point;
    }

    public setPoint(p: Point): void {
        this.point = p;
    }

    public getControlPoint(): Maybe<Point> {
        return this.controlPoint;
    }

    public getRole(): number {
        return this.role;
    }

    public getIndex(): number {
        return this.index;
    }

    public setIndex(index: number): void {
        this.index = index;
    }

    /**
     * Set the connected node.
     *
     * @param node a Renderable that can be connected to a RenderableReaction
     */
    public setConnectedNode(node: Node): void {
        this.connectedNode = node;
        this.invalidate = true;
        // Want to get the ratio to be used for RenderableGene.
        if (!isUndef(this.connectedNode) && !isUndef(this.connectedNode.getBounds())) {
            let bounds: Rectangle = this.connectedNode!.getBounds()!;
            this.ratio = (this.point.x - bounds!.x) / bounds!.width;
        }
    }

    /**
     * Replace the connected Node with a passed Node object.
     *
     * @param node Node object with which to replace the connected Node
     */
    public replaceConnectedNode(node: Node): void {
        if (this.connectedNode == null) {
            return;
        }
        this.connectedNode.removeConnectWidget(this);
        node.addConnectWidget(this);
        this.setConnectedNode(node);
    }

    /**
     * The relative position of the link point at the node's bounds.
     *
     * @return Ratio value
     */
    public getLinkRatio(): number {
        return this.ratio;
    }

    public getConnectedNode(): Maybe<Node> {
        return this.connectedNode;
    }

    public setEdge(reaction: HyperEdge): void {
        this.edge = reaction;
    }

    public getEdge(): Maybe<HyperEdge> {
        return this.edge;
    }

    public setControlPoint(p?: Point): void {
        this.controlPoint = p;
    }

    /**
     * Mark this ConnectWidget as invalid. An invalid ConnectWidget should be validated before its information
     * is used for drawing.
     */
    public doInvalidate(): void {
        this.invalidate = true;
    }

    public isInvalidate(): boolean {
        return this.invalidate;
    }

    /**
     * Use this method to re-calculate the connected position between node and link.
     */
    public validate(): void {
        // Do nothing.
        if (!this.invalidate || isUndef(this.connectedNode))
            return;
        // Mark reaction bounds is not correct
        if (!isUndef(this.getEdge()))
            this.getEdge()?.invalidateBounds();
        this.invalidate = false;
        this.connectedNode!.validateConnectWidget(this);
    }

    /**
     * Override the superclass method and let the contained point to determine the identity of ConnectWidget.
     *
     * @param obj Object to check for equality with this ConnectWidget
     * @return true if the object is an instance of ConnectWidget and its point is the same as this
     * object's point or they are equivalent by the parent class' overridden equals method; false otherwise
     */
    public equals(obj: any): boolean {
        if (obj instanceof ConnectWidget) {
            let another: ConnectWidget = obj;
            if (!isUndef(this.point) && this.point === another.point)
                return true;
            else
                return false;
        }
        else
            return false;
    }

    /**
     * Connect the selected node and edge.
     */
    public connect(): void {
        if (!isUndef(this.edge)) {
            this.edge!.addConnectWidget(this);
        }
        if (!isUndef(this.connectedNode)) {
            this.connectedNode!.addConnectWidget(this);
        }
    }

    /**
     * Disconnect the node and edge.
     */
    public disconnect(): void {
        if (!isUndef(this.edge)) {
            this.edge!.removeConnectWidget(this);
        }
        if (!isUndef(this.connectedNode)) {
            this.connectedNode!.removeConnectWidget(this);
        }
    }

    public setStoichiometry(stoi: number): void {
        this.stoichiometry = stoi;
    }

    public getStoichiometry(): number {
        return this.stoichiometry;
    }
}
