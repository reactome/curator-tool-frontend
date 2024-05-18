import { Point } from './Point';
import { HyperEdge } from './HyperEdge';
import { Maybe, isUndef } from './Utils';

/**
 * An Edge class for describing information flow or direction in a pathway.
 */
export class FlowLine extends HyperEdge {

    constructor() {
        super();
        this.setNeedOutputArrow(true);
        this.lineWidth = 2.0;
        // Don't want to change the super constructor. So remove one point here.
        this.backbonePoints.splice(1, 1);
    }

    public override getType(): string {
        return "Flowline";
    }

    public override setBackbonePoints(points: Array<any>): void {
        this.backbonePoints = points;
    }

    /**
     * Use this method to check if some points used in the lines should
     * be removed. If points should be removed, they will be removed in
     * this method.
     *
     * @return true for some points are removed false for no points removed.
     */
    protected override validatePointsForLayout(): boolean {
        if (this.backbonePoints.length < 3)
            return false; // Should not less than two points.
        let prevP: Point;
        let nextP: Point;
        let p: Point;
        prevP = this.backbonePoints[0];
        let lastIndex = this.backbonePoints.length - 1;
        let distSq: number;
        let removePoints: Point[] = [];
        for (let i = 1; i < lastIndex; i++) {
            p = this.backbonePoints[i];
            nextP = this.backbonePoints[i + 1];
            // Check if p is in the line segment between prevP and nextP.
            /* TODO: Commented out temporarily due to the lack of Line2D
            distSq = Line2D.ptSegDistSq(prevP.x, prevP.y, nextP.x, nextP.y, p.x, p.y);
            if (distSq < this.SENSING_DISTANCE_SQ) { // Remove point p.
                removePoints.push(p);
            } */
            prevP = p;
        }
        for (let it = 0; it < removePoints.length; it++) {
            p = removePoints[it];
            this.backbonePoints.splice(this.backbonePoints.indexOf(p), 1);
        }
        if (removePoints.length > 0) {
            // Need to make sure all control points are correct
            this.validateAllWidgetControlPoints();
            return true;
        }
        else
            return false;
    }

    /**
     * Use this method to initialize the position info for a brand new RenderableReaction.
     *
     * @param p the position.
     */
    public override initPosition(p: Point): void {
        let inputHub: Point = new Point(p.x - 40, p.y);
        this.setInputHub(inputHub);
        let outputHub: Point = new Point(p.x + 40, p.y);
        this.setOutputHub(outputHub);
        this.needCheckBounds = true;
    }

    /**
     * Do nothing in set position. There is no position needed for FlowLine objects.
     */
    public override setPosition(p: Point): void {
    }

    /**
     * A position for a FlowLine object is the medium point from the list of backbone
     * points. If the total number of backbone points is even, the middle point is
     * calculated on the fly for the two medium points.
     *
     * @return Position for this FlowLine object as a Point
     */
    public override getPosition(): Point {
        let size: number = this.backbonePoints.length;
        let x: Maybe<number>;
        let y: Maybe<number>
        if (size % 2 === 0) {
            let index: number = size / 2;
            let p1: Point = this.backbonePoints[index];
            let p2: Point = this.backbonePoints[index - 1];
            x = (p1.x + p2.x) / 2;
            y = (p1.y + p2.y) / 2;
        }
        else {
            let index: number = size / 2;
            let tmp: Point = this.backbonePoints[index];
            x = tmp.x;
            y = tmp.y;
        }
        return new Point(x!, y!);
    }

    /**
     * Override the super class method to provide a simple implementation for
     * FlowLine objects.
     *
     * @param pos Point object to initialize this FlowLine object's position (nothing done if the Point is null)
     * @see #initPosition(Point)
     */
    public override layoutForPoint(pos: Point): void {
        if (isUndef(pos))
            return;
        this.initPosition(pos);
    }

    public override validateBounds(): void {
        if (isUndef(this.bounds)) {
          return;
        }
        // Reset the bounds
        this.bounds!.width = 5; // Minimum
        this.bounds!.height = 5; // Minimum
        // Get all points related to this edge to do checking
        let p = this.backbonePoints[0];
        this.bounds!.x = p.x;
        this.bounds!.y = p.y;
        for (let i = 1; i < this.backbonePoints.length; i++) {
            p = this.backbonePoints[i];
            if (p.x > this.bounds!.width + this.bounds!.x) {
                this.bounds!.width = p.x - this.bounds!.x;
            }
            else if (p.x < this.bounds!.x) {
                this.bounds!.width += (this.bounds!.x - p.x);
                this.bounds!.x = p.x;
            }
            if (p.y > this.bounds!.height + this.bounds!.y) {
                this.bounds!.height = p.y - this.bounds!.y;
            }
            else if (p.y < this.bounds!.y) {
                this.bounds!.height += (this.bounds!.y - p.y);
                this.bounds!.y = p.y;
            }
        }
        // Give it an extra space
        this.bounds!.x -= 6;
        this.bounds!.y -= 6;
        this.bounds!.width += 12;
        this.bounds!.height += 12;
        this.needCheckBounds = false;
    }
}
