import { ContainerNode } from './ContainerNode';
import { Graphics } from './Graphics';
import { Rectangle } from './Rectangle';
import { Point } from './Point';
import { Renderable } from './Renderable';
import { HyperEdge } from './HyperEdge';
import { Maybe, isUndef } from './Utils';
import { Instance } from "../models/reactome-instance.model";

export class RenderablePathway extends ContainerNode {
    // Used to control if compartment names should be hidden
    private hideCompartmentInNode: boolean = false;
    private nextID: number = -1;
    // A RenderablePathway actually is correspondent to PathwayDiagram instance
    // in the Reactome schema. One PathwayDiagram instance may be used by more than
    // one Pathway instance.
    private reactomeDiagramId: Maybe<number>;
    // Used to handle two-layer drawing for disease pathways
    private bgComponents: Maybe<Renderable[]>; // For components drawn as background
    private fgComponents: Maybe<Renderable[]>; // For components drawn as foreground

    /**
     * Creates a new instance of RenderablePathway
     */
    constructor(displayName: string) {
        super(displayName);
        this.setDisplayName(displayName);
        this.components = [];
        this.nextID = 0;
        this.boundsBuffer = 8;
        this.hideComponents = true; // Used as default
        this.isTransferrable = false;
        this.isLinkable = false;
    }

    public getHideCompartmentInNode(): boolean {
        return this.hideCompartmentInNode;
    }

    /**
     * Set the corresponding PathwayDiagram DB_ID for this RenderablePathway.
     *
     * @param dbId DbId to set as the diagram id
     */
    public setReactomeDiagramId(dbId: number): void {
        this.reactomeDiagramId = dbId;
    }

    public getReactomeDiagramId(): Maybe<number> {
        // Check if there is a PathwayDiagram instance set
        let instance: Maybe<Instance> = this.getInstance();
        if (!isUndef(instance) && instance!.schemaClassName === "PathwayDiagram")
            return instance!.dbId;
        return this.reactomeDiagramId;
    }

    /**
     * This method has been deprecated in this RenderablePathway class. A RenderablePathway
     * may be corresponding to more than one Pathway instance. Use getReactomeDiagramId() instead.
     *
     * @return DbId of the Reactome pathway
     */
    public override getReactomeId(): number {
        return super.getReactomeId();
    }

    /**
     * Set the flag to hide compartment names in nodes contained by this RenderablePathway
     * object.
     *
     * @param hide True to hide compartment names; false otherwise
     */
    public setHideCompartmentInNode(hide: boolean): void {
        this.hideCompartmentInNode = hide;
        if (isUndef(this.components) || this.components!.length == 0 || !hide) {
            return;
        }
    }

    public override setIsSelected(isSelected: boolean): void {
        super.setIsSelected(isSelected);
        // Highlight all contained events to show the contained
        // reactions.
        if (!isUndef(this.components)) {
            for (let obj of this.components!) {
                if (obj instanceof HyperEdge) {
                    (obj as HyperEdge).setIsHighlighted(isSelected);
                }
            }
        }
    }

    public layout(type: number): void {
        // TODO: Commented out temporarily due to lack fo PathwayLayoutHelper
        // const helper: PathwayLayoutHelper = new PathwayLayoutHelper(this);
        // helper.layout(type);
    }

    public override generateUniqueID(): number {
        this.nextID++;
        return this.nextID;
    }

    public resetNextID(): void {
        this.nextID = -1;
        if (isUndef(this.components) || this.components!.length == 0) {
            return;
        }
        for (let r of this.components!) {
            if (r.getID() > this.nextID) {
                this.nextID = r.getID();
            }
        }
    }

    public override getType(): string {
        return "Pathway";
    }

    public override select(rect: Rectangle): void {
        if (!this.isVisible) {
            return;
        }
        super.select(rect);
    }

    public override isPicked(p: Point): boolean {
        // Block selection if it is not visible
        if (!this.isVisible || isUndef(this.bounds))
            return false;

        // Check the distance between P and the bound
        // east
        let x1: number = this.bounds!.x + this.bounds!.width;
        let y1: number = this.bounds!.y;
        let x2: number = x1;
        let y2: number = this.bounds!.y + this.bounds!.height;
        // TODO: Temporarily commented out due to lack of Line2D
        // let distSqr: number = Line2D.ptSegDistSq(x1, y1, x2, y2, p.x, p.y);
        let distSqr: number = 0; // TODO: Placeholder for the above
        if (distSqr < this.SENSING_DISTANCE_SQ) {
            return true;
        }
        // south
        x1 = x2;
        y1 = y2;
        x2 = this.bounds!.x;
        y2 = y1;
        // TODO: Temporarily commented out due to lack of Line2D
        // distSqr = Line2D.ptSegDistSq(x1, y1, x2, y2, p.x, p.y);
        if (distSqr < this.SENSING_DISTANCE_SQ) {
            return true;
        }
        // west
        x1 = x2;
        y1 = y2;
        x2 = x1;
        y2 = this.bounds!.y;
        // TODO: Temporarily commented out due to lack of Line2D
        // distSqr = Line2D.ptSegDistSq(x1, y1, x2, y2, p.x, p.y);
        if (distSqr < this.SENSING_DISTANCE_SQ) {
            return true;
        }
        // north
        x1 = x2;
        y1 = y2;
        x2 = this.bounds!.x + this.bounds!.width;
        y2 = y1;
        // TODO: Temporarily commented out due to lack of Line2D
        // distSqr = Line2D.ptSegDistSq(x1, y1, x2, y2, p.x, p.y);
        if (distSqr < this.SENSING_DISTANCE_SQ) {
            return true;
        }
        return false;
    }

    protected override resetLinkWidgetPositions(): void {
        if (!this.linkWidgetPositions) {
            this.linkWidgetPositions = [];
        }
    }

    public override getLinkWidgetPositions(): Maybe<Point[]> {
        this.resetLinkWidgetPositions();
        return super.getLinkWidgetPositions();
    }

    public override isAssignable(r: Renderable): boolean {
        return false;
    }

    public override addComponent(renderable: Renderable): void {
        super.addComponent(renderable);
        this.needCheckBounds = true;
    }

    public override validateBounds(g: Graphics): void {
        if (!this.needCheckBounds)
            return;
        if (isUndef(this.bounds))
            this.bounds = new Rectangle(0, 0, 0, 0);
        if (isUndef(this.components) || this.components!.length == 0)
            return;

        // Initialize by finding a non-empty components in case
        // the first component has no bounds
        let next = 0;
        for (let i = 0; i < this.components!.length; i++) {
            let r: Renderable = this.components![0];
            let rB: Maybe<Rectangle> = r.getBounds();
            if (!isUndef(rB)) {
                this.bounds!.x = rB!.x;
                this.bounds!.y = rB!.y;
                this.bounds!.width = rB!.width;
                this.bounds!.height = rB!.height;
                next = i + 1;
                break;
            }
        }

        for (let i = next; i < this.components!.length; i++) {
            let r: Renderable = this.components![i];
            let rB: Maybe<Rectangle> = r.getBounds();
            if (isUndef(rB))
                continue;
            let x1: number = Math.min(this.bounds!.x, rB!.x);
            let x2: number = Math.max(this.bounds!.x + this.bounds!.width, rB!.x + rB!.width);
            let y1: number = Math.min(this.bounds!.y, rB!.y);
            let y2: number = Math.max(this.bounds!.y + this.bounds!.height, rB!.y + rB!.height);
            this.bounds!.x = x1;
            this.bounds!.y = y1;
            this.bounds!.width = x2 - x1;
            this.bounds!.height = y2 - y1;
        }
    }

    /**
     * Check if the passed Renderable is contained by this RenderablePathway. A Renderable object
     * can be contained by several RenderablePathway. So a simple container based checking, which
     * is implemeneted in ContainerNode, cannot work in case this passed Renderable object is contained
     * by several pathways.
     */
    public override contains(r: Renderable): boolean {
        if (isUndef(this.components))
            return false;
        return this.components!.includes(r);
    }

    public setBgComponents(comps: Renderable[]): void {
        this.bgComponents = comps;
    }

    public getBgComponents(): Maybe<Renderable[]>{
        return this.bgComponents;
    }

    public setFgComponents(comps: Renderable[]): void {
        this.fgComponents = comps;
    }

    public getFgComponents(): Maybe<Renderable[]> {
        return this.fgComponents;
    }
}
