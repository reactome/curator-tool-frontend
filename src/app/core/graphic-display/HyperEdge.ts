// This class is a placeholder for the port from
// https://github.com/reactome/CuratorTool/blob/4615acb7fb20c444333cc458e14ada00c6d0603f/src/org/gk/render/HyperEdgeConstants.java#L71

import { Point } from './Point';
import { Rectangle } from './Rectangle';
import { Node } from './Node';
import { HyperEdgeSelectionInfo } from './HyperEdgeSelectionInfo';
import { HyperEdgeConnectInfo } from './HyperEdgeConnectInfo';
import { HyperEdgeConstants } from './HyperEdgeConstants';
import { ConnectInfo } from './ConnectInfo';
import { ConnectWidget } from './ConnectWidget';
import { Renderable } from './Renderable';
import { Maybe, isUndef } from './Utils';

export class HyperEdge extends Renderable {

    // backbone is the central line that input or output can be attached. backbonesPoints shouldn't be null if
    // the reaction needed to be displayed.
    protected backbonePoints: Point[];

    // input is a list of lists. inputPoints should be null when there is no or one input.
    private inputPoints?: Point[][];

    // output is another list of lists. outputPoints should be null when there is no or one output.
    private outputPoints?: Point[][];

    // helper is similar to output. Helper should be attached to position
    private helperPoints?: Point[][];

    protected inhibitorPoints?: Point[][];
    protected activatorPoints?: Point[][];

    private needInputArrow: boolean = false;
    private needOutputArrow: boolean = false;

    // For selection
    private selectionInfo: HyperEdgeSelectionInfo;

    /** Creates a new instance of ReactionRenderHelper */
    constructor() {
        super();
        // Make sure the backbone points it not null.
        this.backbonePoints = new Array<Point>(3);
        for (let i = 0; i < 3; i++) {
            this.backbonePoints[i] = new Point(0,0);
        }
        // Have to specify a position in the backbone list
        this.position = this.backbonePoints[1];
        this.selectionInfo = new HyperEdgeSelectionInfo();
        this.connectInfo = new HyperEdgeConnectInfo();
        this.bounds = new Rectangle(0,0,0,0);
        this.isTransferrable = false;
    }

    public override setPosition(pos: Point): void {
        if (isUndef(pos)) {
            return;
        }
        this.position!.x = pos.x;
        this.position!.y = pos.y;
        this.needCheckBounds = true;
    }

    /**
     * Layout this HyperEdge based on the terminal points.
     */
     public layout(): void {
        let node: Maybe<Renderable>;
        let inputTerms: Array<Point> = [];
        let inputNodes: Maybe<Node[]> = this.getInputNodes();
        let isOK: boolean = true;
        if (isUndef(this.inputPoints) || this.inputPoints!.length === 0) {
            if (isUndef(inputNodes) || inputNodes!.length === 0)
                inputTerms.push(this.getInputHub());
            else {
                node = inputNodes![0] as unknown as Renderable;
                if (!isUndef(node) && !isUndef(node!.getPosition())) {
                  inputTerms.push(node!.getPosition()!);
                }
            }
        }
        else {
          for (let index = 0; index < this.inputPoints!.length; index++) {
              if (!isUndef(inputNodes) && index < inputNodes!.length) {
                  node = inputNodes![index] as unknown as Renderable;
                  if (!isUndef(node) && !isUndef(node!.getPosition())) {
                    inputTerms.push(node!.getPosition()!);
                  }
              } else {
                  let list: Point[] = this.inputPoints![index];
                  inputTerms.push(list[0]);
              }
          }
        }

        const outputTerms: Point[] = [];
        const outputNodes: Maybe<Node[]> = this.getOutputNodes();

        if (!isUndef(outputNodes)) {
            if (isUndef(this.outputPoints) || this.outputPoints!.length == 0) {
                if (outputNodes!.length == 0) {
                    outputTerms.push(this.getOutputHub());
                } else {
                    node = outputNodes![0] as unknown as Renderable;
                    if (!isUndef(node) && !isUndef(node!.getPosition())) {
                      outputTerms.push(node!.getPosition()!);
                    }
                }
            } else {
                for (let i = 0; i < this.outputPoints!.length; i++) {
                    if (i < outputNodes!.length) {
                        node = outputNodes![i] as unknown as Renderable;
                        if (!isUndef(node) && !isUndef(node!.getPosition())) {
                          outputTerms.push(node!.getPosition()!);
                        }
                    } else {
                        let list: Point[] = this.outputPoints![i];
                        outputTerms.push(list[0]);
                    }
                }
            }
        }

        // These four situations can be used for layouting.
        // All inputs are above the outputs
        for (let inputTerm of inputTerms) {
          if (!isOK) {
            break;
          }
          for (let outputTerm of outputTerms) {
                if (inputTerm.y >= outputTerm.y) {
                    isOK = false;
                    break;
                }
            }
        }

        // Do input up, output down alignment
        if (isOK) {
            let totalX1 = 0;
            let maxY1 = Number.MIN_VALUE;
            for (let p of inputTerms) {
                totalX1 += p.x;
                if (maxY1 < p.y)
                    maxY1 = p.y;
            }
            let avgX1 = totalX1 / inputTerms.length;

            let totalX2 = 0;
            let minY2 = Number.MAX_VALUE;
            for (let p of outputTerms) {
                totalX2 += p.x;
                if (minY2 > p.y)
                     minY2 = p.y;
            }
            let avgX2 = totalX2 / outputTerms.length;

            // Align the backbone points.
            let buffer = 1 / 6.0; // for spaces in the two terminals.
            let size = this.backbonePoints.length;
            let step = (1 - 2 * buffer) / (size - 1);
            let factor = buffer;
            let centerX = (avgX1 + avgX2) / 2;
            let diffY = minY2 - maxY1;
            for (let i = 0; i < this.backbonePoints.length; i++) {
                let p = this.backbonePoints[i];
                p.x = centerX;
                p.y = Math.round(maxY1 + diffY * factor);
                factor += step;
            }
            this.validatePointsForLayout();
            this.invalidateConnectWidgets();
            this.needCheckBounds = true;
            return;
        }

        isOK = true;
        for (let inputTerm of inputTerms) {
            if (!isOK) {
              break;
            }
            for (let outputTerm of outputTerms) {
                if (outputTerm.y >= inputTerm.y) {
                    isOK = false;
                    break;
                }
            }
        }

        if (isOK) {
            let totalXInput = 0;
            let minYInput = Number.MAX_VALUE;

            for (let i = 0; i < inputTerms.length; i++) {
                let point = inputTerms[i];
                totalXInput += point.x;
                if (minYInput > point.y) {
                    minYInput = point.y;
                }
            }

            totalXInput /= inputTerms.length;

            let totalXOutput = 0;
            let maxYOutput = Number.MIN_VALUE;

            for (let i = 0; i < outputTerms.length; i++) {
                let point = outputTerms[i];
                totalXOutput += point.x;
                if (maxYOutput < point.y) {
                    maxYOutput = point.y;
                }
            }

            totalXOutput /= outputTerms.length;

            // Align the backbone points.
            const buffer = 1 / 6.0; // for spaces in the two terminals.
            const size = this.backbonePoints.length;
            const step = (1 - 2 * buffer) / (size - 1);
            let factor = buffer;
            let centerX = (totalXInput + totalXOutput) / 2;
            let diffY = maxYOutput - minYInput;

            for (let i = 0; i < this.backbonePoints.length; i++) {
                let point = this.backbonePoints[i];
                point.x = centerX;
                point.y = Math.floor(minYInput + diffY * factor);
                factor += step;
            }

            this.validatePointsForLayout();
            this.invalidateConnectWidgets();
            this.needCheckBounds = true;
            return;
        }

        // All inputs are left to all outputs
        isOK = true;
        for (let inputTerm of inputTerms) {
            let inputTermPoint: Point = inputTerm as Point;
            for (let outputTerm of outputTerms) {
                let outputTermPoint: Point = outputTerm as Point;
                if (outputTermPoint.x <= inputTermPoint.x) {
                    isOK = false;
                    break;
                }
            }
        }

        if (isOK) {
            let maxX1 = Number.MIN_VALUE;
            let sumY1 = 0;
            for (let p of inputTerms) {
                if (p.x > maxX1)
                    maxX1 = p.x;
                sumY1 += p.y;
            }
            let avgY1 = sumY1 / inputTerms.length;
            let minX2 = Number.MAX_VALUE;
            let sumY2 = 0;
            for (let p of outputTerms) {
                if (p.x < minX2)
                    minX2 = p.x;
                sumY2 += p.y;
            }
            let avgY2 = sumY2 / outputTerms.length;
            // Align the backbone points.
            let buffer = 1 / 6.0; // for spaces in the two terminals.
            let size = this.backbonePoints.length;
            let step = (1 - 2 * buffer) / (size - 1);
            let factor = buffer;
            let y = (avgY1 + avgY2) / 2;
            let diffX = minX2 - maxX1;
            //TODO Need to consider cases where only one input or one output
            for (let i = 0; i < this.backbonePoints.length; i++) {
                let p = this.backbonePoints[i] as Point;
                p.y = y;
                p.x = Math.round(maxX1 + diffX * factor);
                factor += step;
            }
            this.validatePointsForLayout();
            this.invalidateConnectWidgets();
            this.needCheckBounds = true;
            return;
        }

        isOK = true;
        for (let inputTerm of inputTerms) {
            let inputPoint: Point = inputTerm;
            for (let outputTerm of outputTerms) {
                let outputPoint: Point = outputTerm;
                if (outputPoint.x >= inputPoint.x) {
                    isOK = false;
                    break;
                }
            }
        }

        if (isOK) {
            let minX = Number.MAX_VALUE;
            let minY = 0;

            for (let it of inputTerms) {
                let p = it as Point;
                if (p.x < minX)
                    minX = p.x;
                minY += p.y;
            }
            minY /= inputTerms.length;

            let maxX = Number.MIN_VALUE;
            let maxY = 0;

            for (let it of outputTerms) {
                let p = it as Point;
                if (p.x > maxX)
                    maxX = p.x;
                maxY += p.y;
            }
            maxY /= outputTerms.length;

            // Align the backbone points.
            let buffer = 1 / 6.0; // for spaces in the two terminals.
            let size = this.backbonePoints.length;
            let step = (1 - 2 * buffer) / (size - 1);
            let factor = buffer;
            let y = (minY + maxY) / 2;
            let diffX = maxX - minX;

            for (let i = 0; i < this.backbonePoints.length; i++) {
                let p = this.backbonePoints[i] as Point;
                p.y = y;
                p.x = Math.floor(minX + diffX * factor);
                factor += step;
            }

            this.validatePointsForLayout();
            this.invalidateConnectWidgets();
            this.needCheckBounds = true;
            return;
        }

        // Just in case
        let pInput: Point = inputTerms[0];
        let x1: number = pInput.x;
        let y1: number = pInput.y;
        let pOutput: Point = outputTerms[0];
        let x2: number = pOutput.x;
        let y2: number = pOutput.y;

        // Align the backbone points.
        let buffer: number = 1 / 6.0; // for spaces in the two terminals.
        let size: number = this.backbonePoints.length;
        let step: number = (1 - 2 * buffer) / (size - 1);
        let factor: number = buffer;
        let y: number = (y1 + y2) / 2;
        let diffX: number = x2 - x1;

        for (let i: number = 0; i < this.backbonePoints.length; i++) {
            let p: Point = this.backbonePoints[i];
            p.y = y;
            p.x = Math.floor(x1 + diffX * factor);
            factor += step;
        }

        this.validatePointsForLayout();
        if (!isUndef(this.connectInfo)) {
            this.connectInfo!.invalidate();
        }
        this.needCheckBounds = true;
    }

    /**
     * Use this method to check if some points used in the lines should
     * be removed. If points should be removed, they will be removed in
     * this method.
     *
     * @return true if some points are removed; false if no points removed
     */
    protected validatePointsForLayout(): boolean {
        let rtn: boolean = false;
        let needValidateControl: boolean = this.validatePoints(this.inputPoints);
        if (needValidateControl)
            this.validateWidgetControlPoints(HyperEdgeConstants.INPUT);
        rtn ||= needValidateControl;
        needValidateControl = this.validatePoints(this.outputPoints);
        if (needValidateControl)
            this.validateWidgetControlPoints(HyperEdgeConstants.OUTPUT);
        rtn ||= needValidateControl;
        needValidateControl = this.validatePoints(this.helperPoints);
        if (needValidateControl)
            this.validateWidgetControlPoints(HyperEdgeConstants.CATALYST);
        rtn ||= needValidateControl;
        needValidateControl = this.validatePoints(this.inhibitorPoints);
        if (needValidateControl)
            this.validateWidgetControlPoints(HyperEdgeConstants.INHIBITOR);
        rtn ||= needValidateControl;
        needValidateControl = this.validatePoints(this.activatorPoints);
        if (needValidateControl)
            this.validateWidgetControlPoints(HyperEdgeConstants.ACTIVATOR);
        rtn ||= needValidateControl;
        this.validatePosition();
        return rtn;
    }

    private validatePoints(pointsList: Maybe<Point[][]>): boolean {
        let rtn: boolean = false;
        if (!isUndef(pointsList) && pointsList!.length > 0) {
            for (let it = 0; it < pointsList!.length; it++) {
                let points: Point[] = pointsList![it];
                while (points.length > 1) {
                    points.splice(1, 1);
                    rtn = true;
                }
            }
        }
        return rtn;
    }

    /**
     * Automatically rearrange position of all input, output and catalyst positions.
     *
     * @param pos Point object to set the new position of this HyperEdge
     */
    public layoutForPoint(pos: Point): void {
        if (isUndef(pos) || isUndef(this.position))
            return;
        this.position!.x = pos.x;
        this.position!.y = pos.y;
        // Reset the backbone positions
        let w: number = 75;
        let p1: Point = this.backbonePoints[0]; // Input hub
        p1.x = pos.x - 100;
        p1.y = pos.y;
        this.backbonePoints[1] = this.position!;
        let p2: Point = this.backbonePoints[this.backbonePoints.length - 1]; // Output hub
        p2.x = pos.x + 100;
        p2.y = pos.y;
        this.backbonePoints[2] = p2;
        // Remove all extra points
        for (let i: number = 3; i < this.backbonePoints.length; i++) {
            this.backbonePoints.splice(3, 1);
        }

        // Arrange inputBranches
        if (!isUndef(this.inputPoints) && this.inputPoints!.length > 0) {
            let size: number = this.inputPoints!.length;
            let div: number = Math.PI / size;
            let shift: number = div / 2;
            let x: number, y: number;
            for (let i = 0; i < size; i++) {
                x = (w * Math.sin((i + 1) * div - shift));
                y = (w * Math.cos((i + 1) * div - shift));

                let list: Point[] = this.inputPoints![i];
                let p: Point = list[0];
                p.x = p1.x - x;
                p.y = p1.y - y;
                // Purge the points
                for (let j = 1; j < list.length; j++)
                    list.splice(1, 1);
            }
        }

        // This code snippet arranges output branches based on output points
        if (!isUndef(this.outputPoints) && this.outputPoints!.length > 0) {
            const size: number = this.outputPoints!.length;
            const div: number = Math.PI / size;
            const shift: number = div / 2;
            let x: number, y: number;
            for (let i = 0; i < size; i++) {
                x = Math.floor(w * Math.sin((i + 1) * div - shift));
                y = Math.floor(w * Math.cos((i + 1) * div - shift));
                const list: Point[] = this.outputPoints![i];
                const p: Point = list[0];
                p.x = p2.x + x;
                p.y = p2.y - y;
                // Purge the points
                for (let j = 1; j < list.length; j++)
                    list.splice(1, 1);
            }
        }

        // Arrange helperBranches, inhibitorBranches and activatorBranches
        let branches: Point[][] = [];
        if (!isUndef(this.helperPoints))
            branches.push(...this.helperPoints!);
        if (!isUndef(this.inhibitorPoints))
            branches.push(...this.inhibitorPoints!);
        if (!isUndef(this.activatorPoints))
            branches.push(...this.activatorPoints!);
        if (branches.length > 0) {
            let size: number = branches.length;
            let div: number = 2 * Math.PI / size;
            let x: number, y: number;
            for (let i = 0; i < size; i++) {
                x = Math.round(w * Math.sin(i * div));
                y = Math.round(w * Math.cos(i * div));
                let list: Array<Point> = branches[i];
                let p: Point = list[0];
                p.x = pos.x - x;
                p.y = pos.y - y;
                // Purge the points
                for (let j = 1; j < list.length; j++)
                    list.splice(1, 1);
            }
        }

        // Check nodes that are connected
        if (!isUndef(this.connectInfo)) {
          const widgets: Maybe<ConnectWidget[]> = this.connectInfo!.getConnectWidgets();
          if (!isUndef(widgets) && widgets!.length > 0) {
              for (const widget of widgets!) {
                  if (isUndef(widget.getConnectedNode())) {
                      continue;
                  }
                  const node: Renderable = widget.getConnectedNode()! as Renderable;
                  let list: Point[] = [];
                  let p: Maybe<Point>;
                  if (widget.getRole() === HyperEdgeConstants.INPUT) {
                      if (isUndef(this.inputPoints) || this.inputPoints!.length === 0) {
                          p = this.backbonePoints[0];
                      } else {
                          list = this.inputPoints![widget.getIndex()];
                          p = list[0];
                      }
                  } else if (widget.getRole() === HyperEdgeConstants.OUTPUT) {
                      if (isUndef(this.outputPoints)  || this.outputPoints!.length === 0) {
                          p = this.backbonePoints[2];
                      } else {
                          list = this.outputPoints![widget.getIndex()];
                          p = list[0];
                      }
                  } else if (widget.getRole() === HyperEdgeConstants.CATALYST) {
                        list = this.helperPoints![widget.getIndex()];
                        p = list[0];
                  } else if (widget.getRole() === HyperEdgeConstants.INHIBITOR) {
                        list = this.inhibitorPoints![widget.getIndex()];
                        p = list[0];
                  } else if (widget.getRole() === HyperEdgeConstants.ACTIVATOR) {
                        list = this.activatorPoints![widget.getIndex()];
                        p = list[0];
                  }
                  // Use move only. It is not right to set the position directly.
                  const oldPos: Maybe<Point> = node.getPosition();
                  if (isUndef(oldPos)) {
                      node.setPosition(new Point(p!.x, p!.y));
                  } else {
                      // Do move
                      const dx: number = p!.x - oldPos!.x;
                      const dy: number = p!.y - oldPos!.y;
                      node.move(dx, dy);
                  }
                  widget.doInvalidate();
              }
          }
        }
        this.needCheckBounds = true;
    }

    private getInputNodes(): Maybe<Node[]> {
        if (!isUndef(this.connectInfo)) {
          let inputWidgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getInputWidgets();
          return this.getNodesFromWidgets(inputWidgets);
        }
        return undefined;
    }

    private getNodesFromWidgets(widgets: ConnectWidget[]): Node[] {
        if (isUndef(widgets))
            return new Array<Node>();
        const nodeList: Node[] = new Array<Node>(widgets.length);
        if (!isUndef(widgets)) {
            let widget: Maybe<ConnectWidget>;
            for (const it of widgets) {
                widget = it;
                if (!isUndef(widget!.getConnectedNode())) {
                  nodeList.push(widget!.getConnectedNode()!);
                }
            }
        }
        return nodeList;
    }

    private getInputNode(index: number): Maybe<Node> {
        if (!isUndef(this.connectInfo)) {
            let inputWidgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getInputWidgets();
            return this.checkWidgetForNode(inputWidgets, index);
        }
        return undefined;
    }

    private getOutputNodes(): Maybe<Node[]> {
        if (!isUndef(this.connectInfo)) {
            let widgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getOutputWidgets();
            return this.getNodesFromWidgets(widgets);
        }
        return undefined;
    }

    private getOutputNode(index: number): Maybe<Node> {
        if (!isUndef(this.connectInfo)) {
            let widgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getOutputWidgets();
            return this.checkWidgetForNode(widgets, index);
        }
        return undefined;
    }

    private getHelperNodes(): Maybe<Node[]> {
        if (!isUndef(this.connectInfo)) {
            let widgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getHelperWidgets();
            return this.getNodesFromWidgets(widgets);
        }
        return undefined;
    }

    public getInhibitorNodes(): Maybe<Node[]> {
        if (!isUndef(this.connectInfo)) {
            const widgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getInhibitorWidgets();
            return this.getNodesFromWidgets(widgets);
        }
        return undefined;
    }

    public getActivatorNodes(): Maybe<Node[]> {
        if (!isUndef(this.connectInfo)) {
            const widgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getActivatorWidgets();
            return this.getNodesFromWidgets(widgets);
        }
        return undefined;
    }

    public getHelperNode(index: number): Maybe<Renderable> {
        if (!isUndef(this.connectInfo)) {
            const widgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getHelperWidgets();
            return this.checkWidgetForNode(widgets, index) as Maybe<Renderable>;
        }
        return undefined;
    }

    public getInhibitorNode(index: number): Maybe<Renderable> {
        if (!isUndef(this.connectInfo)) {
            const widgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getInhibitorWidgets();
            return this.checkWidgetForNode(widgets, index) as Maybe<Renderable>;
        }
        return undefined;
    }

    private checkWidgetForNode(widgets: ConnectWidget[], index: number): Maybe<Node> {
        if (!isUndef(this.connectInfo)) {
            let widget: ConnectWidget;
            for (let i = 0; i < widgets.length; i++) {
                widget = widgets[i];
                if (widget.getIndex() === index) {
                    return widget.getConnectedNode();
                }
            }
        }
        return undefined;
    }

    private getActivatorNode(index: number): Maybe<Renderable> {
        const widgets: Array<ConnectWidget> = (this.connectInfo as HyperEdgeConnectInfo).getActivatorWidgets();
        return this.checkWidgetForNode(widgets, index) as Maybe<Renderable>;
    }

    public override getPosition(): Maybe<Point> {
        return this.position;
    }

    public setBackbonePoints(points: Point[]): void {
        // Find the position point
        let found: boolean = false;
        for (let p of points) {
            if (!isUndef(this.position) && p.equals(this.position!)) {
                this.position = p;
                found = true;
                break;
            }
        }
        if (!found) {
            throw new Error("HyperEdgeConstants.setBackbonePoints(): backbone points should contain the position point: " +
                                                this.getDisplayName() + " (" + this.getID() + ")");
        } else {
            this.backbonePoints = points;
        }
    }

    public getBackbonePoints(): Point[] {
        return this.backbonePoints;
    }

    public addBackbonePoint(p: Point, index: number): void {
        if (isUndef(this.backbonePoints))
            this.backbonePoints = new Array<Point>();
        this.backbonePoints.splice(index, 0, p);
    }

    public removeBackbonePoint(p: Point): void {
        if (!isUndef(this.backbonePoints)) {
            const index = this.backbonePoints!.indexOf(p);
            if (index > -1) {
                this.backbonePoints!.splice(index, 1);
                this.validateAllWidgetControlPoints();
            }
        }
    }

    public setInputHub(p: Point) {
        // Set the first backbone point
        const inputHub: Point = this.backbonePoints[0] as Point;
        inputHub.x = p.x;
        inputHub.y = p.y;
    }

    public setOutputHub(p: Point) {
        // Set the last backbone point
        const outputHub: Point = this.backbonePoints[this.backbonePoints.length - 1] as Point;
        outputHub.x = p.x;
        outputHub.y = p.y;
    }

    getInputHub(): Point {
        return this.backbonePoints[0];
    }

    getOutputHub(): Point {
        return this.backbonePoints[this.backbonePoints.length - 1];
    }

    /**
     * Getter for property helperPoints.
     *
     * @return Value of property helperPoints, which should be a list of list of Points
     */
    getHelperPoints(): Maybe<Point[][]> {
        return this.helperPoints;
    }

    /**
     * Setter for property helperPoints.
     *
     * @param helperPoints New value of property helperPoints, which should be a list of list of Points
     */
    setHelperPoints(helperPoints: Point[][]): void {
        this.helperPoints = helperPoints;
    }

    /**
     * Java to TypeScript
     *
     * Add a helper point to the helperPoints List (nothing done if the list is null or the helperIndex is out of
     * bounds of the list). The helperPoints list is a 2d list (i.e. a list of lists).  The helperIndex will reference
     * a list of points and the pointerIndex is the index to add the new point.
     *
     * @param p The Point to be added
     * @param helperIndex The index of the helperPoints list
     * @param pointIndex The index at which to add the new helper point in the list retrieved from the
     * helperPoints list
     * @see #removeHelperPoint(Point, int)
     */
    public addHelperPoint(p: Point, helperIndex: number, pointIndex: number): void {
        if (isUndef(this.helperPoints))
            return;
        if (!isUndef(this.helperPoints) && helperIndex < 0 || helperIndex >= this.helperPoints!.length)
            return;
        if (!isUndef(this.helperPoints)) {
          let list: Point[] = this.helperPoints![helperIndex];
          list.splice(pointIndex, 0, p);
        }
    }

    /**
     * Remove a helper point in a specified helper branch (nothing done if the list is null or the helperIndex is out
     * of bounds of the list). The helperPoint list is a 2d list (i.e. a list of lists).  The helperIndex will
     * reference a list of points.
     *
     * @param p The Point to be removed
     * @param helperIndex The index of the helperPoint list (i.e. the point list from which to remove p)
     * @see #addHelperPoint(Point, int, int)
     */
    public removeHelperPoint(p: Point, helperIndex: number): void {
        if (isUndef(this.helperPoints) || helperIndex < 0 || helperIndex >= this.helperPoints!.length)
            return;

        const list: Array<Point> = this.helperPoints![helperIndex];
        const index: number = list.indexOf(p);
        if (index !== -1) {
            list.splice(index, 1);
        }

        if (list.length === 0) {
            this.helperPoints!.splice(helperIndex, 1);
        }
    }

    /**
     * Getter for property inputPoints.
     *
     * @return Value of property inputPoints
     */
    public getInputPoints(): Maybe<Point[][]> {
        return this.inputPoints;
    }

    /**
     * Setter for property inputPoints.
     *
     * @param inputPoints New value of property inputPoints
     */
    public setInputPoints(inputPoints: Point[][]): void {
        this.inputPoints = inputPoints;
    }

    /**
     * Framework: None
     * Technology Stack: None
     *
     * Add a point to a specified input branch at the specified index (nothing done if the inputPoints list is null
     * or the inputIndex is out of bounds of the inputPoints list). The inputPoints list is a 2d list (i.e. a list of
     * lists).  The inputIndex will reference a list of points and the pointIndex is the index to add the new point.
     *
     * @param p Point to add
     * @param inputIndex The index of the inputPoints list
     * @param pointIndex The index at which to add the new input point in the list retrieved from the
     * inputPoints list
     */
    public addInputPoint(p: Point, inputIndex: number, pointIndex: number): void {
        if (isUndef(this.inputPoints) || inputIndex < 0 || inputIndex >= this.inputPoints!.length)
            return;
        const list: Point[] = this.inputPoints![inputIndex];
        list.splice(pointIndex, 0, p);
    }

    /**
     * Getter for property outputPoints.
     *
     * @return Value of property outputPoints
     */
    public getOutputPoints(): Maybe<Point[][]> {
        return this.outputPoints;
    }

    /**
     * Setter for property outputPoints.
     *
     * @param outputPoints New value of property outputPoints
     */
    public setOutputPoints(outputPoints: Point[][]): void {
        this.outputPoints = outputPoints;
    }

    public addOutputPoint(p: Point, outputIndex: number, pointIndex: number): void {
        if (isUndef(this.outputPoints) || outputIndex < 0 || outputIndex > this.outputPoints!.length) {
            return;
        }
        const list: Array<Point> = this.outputPoints![outputIndex];
        list.splice(pointIndex, 0, p);
    }

    /**
     * Getter for property needInputArrow.
     *
     * @returns True if an input arrow is needed; false otherwise
     */
    public isNeedInputArrow(): boolean {
        return this.needInputArrow;
    }

    /**
     * Setter for property needInputArrow.
     *
     * @param needInputArrow True if an input arrow is needed; false otherwise
     */
    public setNeedInputArrow(needInputArrow: boolean): void {
        this.needInputArrow = needInputArrow;
    }

    /**
     * Getter for property needOutputArrow.
     *
     * @returns True if an output arrow is needed; false otherwise
     */
    public isNeedOutputArrow(): boolean {
        return this.needOutputArrow;
    }

    /**
     * Setter for property needOutputArrow.
     *
     * @param needOutputArrow True if an output arrow is needed; false otherwise
     */
    public setNeedOutputArrow(needOutputArrow: boolean): void {
        this.needOutputArrow = needOutputArrow;
    }

    public move(dx: number, dy: number): void {
        // If there is one point is selected, just move that point
        if (!isUndef(this.selectionInfo.selectPoint)) {
            this.selectionInfo.selectPoint!.x += dx;
            this.selectionInfo.selectPoint!.y += dy;
            if (this.selectionInfo.selectPoint!.x < this.pad) {
                this.selectionInfo.selectPoint!.x = this.pad;
            }
            if (this.selectionInfo.selectPoint!.y < this.pad) {
                this.selectionInfo.selectPoint!.y = this.pad;
            }
        }
        // Otherwise move all points
        else {
            const points: Point[] = this.getAllPoints();
            let p: Maybe<Point>;
            for (const point of points) {
                p = point;
                p.x += dx;
                p.y += dy;
                // Make positive
                if (p.x < this.pad) {
                    p.x = this.pad;
                }
                if (p.y < this.pad) {
                    p.y = this.pad;
                }
            }
        }
        this.needCheckBounds = true;
        // Invalidate all ConnectWidgets
        if (!isUndef(this.connectInfo)) {
            this.connectInfo!.invalidate();
        }
    }

    private isBranchPointPicked(branches: Point[][], direction: number, p: Point): boolean {
    //
        let branch: Point[];
        let index: number = 0;
        let distSq: number;
        let p1: Point;
        let hub: Maybe<Point>;

        switch (direction) {
            case HyperEdgeConstants.INPUT:
                hub = this.getInputHub();
                break;
            case HyperEdgeConstants.OUTPUT:
                hub = this.getOutputHub();
                break;
            case HyperEdgeConstants.CATALYST:
                hub = this.getPosition();
                break;
            case HyperEdgeConstants.INHIBITOR:
                hub = this.getPosition();
                break;
            case HyperEdgeConstants.ACTIVATOR:
                hub = this.getPosition();
                break;
        }

        for (let branch of branches) {
            if (isUndef(branch) || branch!.length === 0) {
                continue;
            }

            p1 = branch[0];
            distSq = p1.distanceSq(p);

            if (distSq < this.SENSING_DISTANCE_SQ) {
                this.selectionInfo.selectPoint = p1;
                this.selectionInfo.selectedBranch = index;
                this.selectionInfo.selectedType = direction;

                if (branch.length == 1) {
                    this.selectionInfo.connectWidget = new ConnectWidget(this.selectionInfo.selectPoint, hub!, direction, index);
                } else {
                    this.selectionInfo.connectWidget = new ConnectWidget(this.selectionInfo.selectPoint, branch[1], direction, index);
                }

                return true;
            }

            for (let i = 1; i < branch.length; i++) {
                p1 = branch[i];
                distSq = p1.distanceSq(p);

                if (distSq < this.SENSING_DISTANCE_SQ) {
                    this.selectionInfo.selectPoint = p1;
                    this.selectionInfo.selectedBranch = index;
                    this.selectionInfo.selectedType = direction;

                    return true;
                }
            }

            index++;
        }

        return false;
    }

    protected isBackbonePicked(p: Point): boolean {
        let prevP: Point;
        let nextP: Point;
        prevP = this.backbonePoints[0] as Point;
        let distSq: number;
        for (let i = 1; i < this.backbonePoints.length; i++) {
            nextP = this.backbonePoints[i] as Point;
            // TODO: Commented out temporarily due to lack of Line2D
            // distSq = Line2D.ptSegDistSq(prevP.x, prevP.y, nextP.x, nextP.y, p.x, p.y);
            distSq = 0;
            if (distSq < this.SENSING_DISTANCE_SQ) {
                // When a FlowLine has nodes attached, insert points automatically.
                // Otherwise do nothing.
                this.selectionInfo.selectedType = HyperEdgeConstants.BACKBONE;
                return true;
            }
            prevP = nextP;
        }
        return false;
    }

    protected validateWidgetControlPoints(type: number): void {
        if (isUndef(this.connectInfo)) {
            return;
        }
        const widgets: Maybe<Array<ConnectWidget>> = this.connectInfo!.getConnectWidgets();
        if (isUndef(widgets) || widgets!.length == 0)
            return;
        let widget: ConnectWidget;
        let node: Renderable;
        let index: number = 0;
        const branch: Maybe<Point[][]> = this.getBranchFromType(type);
        const hub: Maybe<Point> = this.getControlFromBackbone(type);
        for (widget of widgets!) {
            index = widget.getIndex();
            const role: number = widget.getRole();
            let controlP: Maybe<Point>;
            if (role != type)
                continue;
            if (isUndef(branch) || branch!.length == 0)
                controlP = hub;
            else {
                const points: Point[] = branch![index];
                if (points.length > 1)
                    controlP = points[1];
                else {
                    controlP = hub;
                }
            }
            widget.setControlPoint(controlP);
        }
    }

    public getBranchFromType(type: Maybe<number>): Maybe<Point[][]> {
        if (!isUndef(type)) {
            switch (type) {
                case HyperEdgeConstants.INPUT:
                    return this.inputPoints;
                case HyperEdgeConstants.OUTPUT:
                    return this.outputPoints;
                case HyperEdgeConstants.CATALYST:
                    return this.helperPoints;
                case HyperEdgeConstants.INHIBITOR:
                    return this.inhibitorPoints;
                case HyperEdgeConstants.ACTIVATOR:
                    return this.activatorPoints;
            }
        }
        return undefined;
    }

    private getControlFromBackbone(type: number): Maybe<Point> {
        switch (type) {
            case HyperEdgeConstants.INPUT:
                if (!isUndef(this.inputPoints) && this.inputPoints!.length > 0)
                    return this.backbonePoints[0];
                else
                    return this.backbonePoints[1];
            case HyperEdgeConstants.OUTPUT:
                if (!isUndef(this.outputPoints) && this.outputPoints!.length > 0)
                    return this.backbonePoints[this.backbonePoints.length - 1];
                else
                    return this.backbonePoints[this.backbonePoints.length - 2];
            case HyperEdgeConstants.INHIBITOR:
            case HyperEdgeConstants.ACTIVATOR:
            case HyperEdgeConstants.CATALYST:
                return this.getPosition();
        }
        return undefined;
    }

    private isBranchPicked(branches: Point[][], hub: Maybe<Point>, p: Point, type: number): boolean {
        let branch: Maybe<Point[]>;
        let prevP: Point, nextP: Maybe<Point>;
        let distSq: number;
        let index: number = 0;

        for (let it = 0; it < branches.length; it++) {
            branch = branches[it];
            if (isUndef(branch) || branch.length == 0) {
                continue;
            }
            for (let i = 0; i < branch.length - 1; i++) {
                prevP = branch[i];
                nextP = branch[i + 1];
                // TODO: Commented out temporarily due to lack of Line2D
                // distSq = Line2D.ptSegDistSq(prevP.x, prevP.y, nextP.x, nextP.y, p.x, p.y);
                distSq = 0;
                if (distSq < this.SENSING_DISTANCE_SQ) {
                    this.selectionInfo.selectedBranch = index;
                    this.selectionInfo.selectedType = type;
                    return true;
                }
            }

            // In case there is only one point in the branch
            nextP = branch[branch.length - 1];
            // TODO: Commented out temporarily due to lack of Line2D
            // distSq = Line2D.ptSegDistSq(nextP.x, nextP.y, hub.x, hub.y, p.x, p.y);
            distSq = 0;
            if (distSq < this.SENSING_DISTANCE_SQ) {
                this.selectionInfo.selectedBranch = index;
                this.selectionInfo.selectedType = type;
                return true;
            }
            index++;
        }

        return false;
    }

    public isPicked(p: Point): boolean {
        if (!this.isVisible) {
            return false;
        }
        let distSq: number;
        let p1: Point;
        this.selectionInfo.reset();

        if (!isUndef(this.inputPoints) && this.inputPoints!.length > 0) {
            if (this.isBranchPointPicked(this.inputPoints!, HyperEdgeConstants.INPUT, p)) {
                return true;
            }
        }

        p1 = this.backbonePoints[0];
        distSq = p1.distanceSq(p);
        if (distSq < this.SENSING_DISTANCE_SQ) {
            this.selectionInfo.selectPoint = p1;
            this.selectionInfo.selectedType = HyperEdgeConstants.BACKBONE;
            if (isUndef(this.inputPoints) || this.inputPoints!.length === 0) {
                this.selectionInfo.connectWidget = new ConnectWidget(this.selectionInfo.selectPoint, this.backbonePoints[1], HyperEdgeConstants.INPUT, 0);
            }
            return true;
        }

        p1 = this.backbonePoints[this.backbonePoints.length - 1];
        distSq = p1.distanceSq(p);
        if (distSq < this.SENSING_DISTANCE_SQ) {
            this.selectionInfo.selectPoint = p1;
            this.selectionInfo.selectedType = HyperEdgeConstants.BACKBONE;
            if (isUndef(this.outputPoints) || this.outputPoints!.length === 0) {
                this.selectionInfo.connectWidget = new ConnectWidget(this.selectionInfo.selectPoint, this.backbonePoints[this.backbonePoints.length - 2], HyperEdgeConstants.OUTPUT, 0);
            }
            return true;
        }

        for (let i = 1; i < this.backbonePoints.length - 1; i++) {
            p1 = this.backbonePoints[i];
            distSq = p1.distanceSq(p);
            if (distSq < this.SENSING_DISTANCE_SQ) {
                this.selectionInfo.selectPoint = p1;
                this.selectionInfo.selectedType = HyperEdgeConstants.BACKBONE;
                return true;
            }
        }

        if (!isUndef(this.outputPoints) && this.outputPoints!.length > 0) {
            if (this.isBranchPointPicked(this.outputPoints!, HyperEdgeConstants.OUTPUT, p)) {
                return true;
            }
        }

        if (!isUndef(this.helperPoints) && this.helperPoints!.length > 0) {
            if (this.isBranchPointPicked(this.helperPoints!, HyperEdgeConstants.CATALYST, p)) {
                return true;
            }
        }

        if (!isUndef(this.inhibitorPoints) && this.inhibitorPoints!.length > 0) {
            if (this.isBranchPointPicked(this.inhibitorPoints!, HyperEdgeConstants.INHIBITOR, p)) {
                return true;
            }
        }

        if (!isUndef(this.activatorPoints) && this.activatorPoints!.length > 0) {
            if (this.isBranchPointPicked(this.activatorPoints!, HyperEdgeConstants.ACTIVATOR, p)) {
                return true;
            }
        }

        if (!isUndef(this.inputPoints) && this.inputPoints!.length > 0) {
            if (this.isBranchPicked(this.inputPoints!, this.getInputHub(), p, HyperEdgeConstants.INPUT)) {
                return true;
            }
        }

        if (this.isBackbonePicked(p)) {
            return true;
        }

        if (!isUndef(this.outputPoints) && this.outputPoints!.length > 0) {
            if (this.isBranchPicked(this.outputPoints!, this.getOutputHub(), p, HyperEdgeConstants.OUTPUT)) {
                return true;
            }
        }

        if (!isUndef(this.helperPoints) && this.helperPoints!.length > 0) {
            if (this.isBranchPicked(this.helperPoints!, this.position, p, HyperEdgeConstants.CATALYST)) {
                return true;
            }
        }

        if (!isUndef(this.inhibitorPoints) && this.inhibitorPoints!.length > 0) {
            if (this.isBranchPicked(this.inhibitorPoints!, this.position, p, HyperEdgeConstants.INHIBITOR)) {
                return true;
            }
        }

        if (!isUndef(this.activatorPoints) && this.activatorPoints!.length > 0) {
            if (this.isBranchPicked(this.activatorPoints!, this.position, p, HyperEdgeConstants.ACTIVATOR)) {
                return true;
            }
        }

        return false;
    }

    /**
     * This method is used to check if a passed point can be used to pick up
     * this HyperEdgeConstants. This method is different from another method isPicked(Point).
     * The internal data structure will not be changed in this method. So a client
     * that should not make changes to the internal data structure should call this method.
     * For example, getToolTipText(MouseEvent)
     *
     * @param p Point to check
     * @return true if the point can be picked; false otherwise
     */
     public override canBePicked(p: Point): boolean {
        if (!this.isVisible)
            return false;
        let p1: Point;
        let distSq: number;
        // Check backbone points
        if (this.canPointBePicked(p))
            return true;
        // Check backbone
        let prevP: Point, nextP: Point;
        for (let i = 0; i < this.backbonePoints.length - 1; i++) {
            prevP = this.backbonePoints[i];
            nextP = this.backbonePoints[i + 1];
            // TODO: Commented out temporarily due to lack of Line2D
            // distSq = Line2D.ptSegDistSq(prevP.x, prevP.y, nextP.x, nextP.y, p.x, p.y);
            distSq = 0;
            if (distSq < this.SENSING_DISTANCE_SQ) {
                return true;
            }
        }
        // Check line segments now
        // Check input branches
        if (this.canBranchBePicked(this.inputPoints,
                                  this.getInputHub(),
                                  p))
            return true;
        // Check output branches
        if (this.canBranchBePicked(this.outputPoints,
                                  this.getOutputHub(),
                                  p))
            return true;
        // Check helper branches
        if (this.canBranchBePicked(this.helperPoints,
                                  this.position,
                                  p))
            return true;
        if (this.canBranchBePicked(this.inhibitorPoints,
                                  this.position,
                                  p))
            return true;
        // Check activator branches
        if (this.canBranchBePicked(this.activatorPoints,
                                  this.position,
                                  p))
            return true;
        return false;
    }

    private canPointBePicked(p: Point): boolean {
        let p1: Point;
        let distSq: number;
        for (let p1 of this.backbonePoints) {
            distSq = p1.distanceSq(p);
            if (distSq < this.SENSING_DISTANCE_SQ) {
                return true;
            }
        }

        // Check input points
        if (this.canBranchPointsBePicked(this.inputPoints, p))
            return true;

        // Check output points
        if (this.canBranchPointsBePicked(this.outputPoints, p))
            return true;

        // Check helper points
        if (this.canBranchPointsBePicked(this.helperPoints, p))
            return true;

        // Check inhibitor points
        if (this.canBranchPointsBePicked(this.inhibitorPoints, p))
            return true;

        // Check activator points
        if (this.canBranchPointsBePicked(this.activatorPoints, p))
            return true;

        return false;
    }

    /**
     * A helper method to check if a Point in a branch can be picked up.
     *
     * @param branches Branch list - List of list of Point objects
     * @param p Point to check
     * @return true if the point can be picked for any branch point; false otherwise
     */
    private canBranchPointsBePicked(branches: Maybe<Point[][]>, p: Point): boolean {
        if (isUndef(branches) || branches!.length == 0)
            return false;
        let branch: Point[];
        let p1: Point;
        let distSq: number;
        for (let it = 0; it < branches!.length; it++) {
            branch = branches![it];
            // Just in case
            if (isUndef(branch) || branch.length == 0)
                continue;
            for (let i = 0; i < branch.length; i++) {
                p1 = branch[i];
                distSq = p1.distanceSq(p);
                if (distSq < this.SENSING_DISTANCE_SQ) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * A helper method to check if a line segment in a branch can
     * be picked up.
     *
     * @param branches List - List of list of Point objects
     * @param hub Point to use if there is only one Point in a branch
     * @param p Point to check
     * @returns true if the point can be picked for any branch
     */
    private canBranchBePicked(branches: Maybe<Point[][]>,
                              hub: Maybe<Point>,
                              p: Point): boolean {
        if (isUndef(branches) || branches!.length == 0)
            return false;
        let branch: Point[];
        let prevP: Point, nextP: Point;
        let distSq: number;
        for (let it = 0; it < branches!.length; it++) {
            branch = branches![it];
            if (isUndef(branch) || branch!.length == 0)
                continue;
            for (let i = 0; i < branch.length - 1; i++) {
                prevP = branch![i];
                nextP = branch![i + 1];
                // TODO: Commented out temporarily due to lack of Line2D
//                 distSq = Line2D.ptSegDistSq(prevP.x,
//                                             prevP.y,
//                                             nextP.x,
//                                             nextP.y,
//                                             p.x,
//                                             p.y);
                distSq = 0;
                if (distSq < this.SENSING_DISTANCE_SQ) {
                    return true;
                }
            }
            // In case there is only one point in the branch
            nextP = branch![branch!.length - 1];
            // TODO: Commented out temporarily due to lack of Line2D
//             distSq = Line2D.ptSegDistSq(nextP.x,
//                                         nextP.y,
//                                         hub.x,
//                                         hub.y,
//                                         p.x,
//                                         p.y);
            distSq = 0;
            if (distSq < this.SENSING_DISTANCE_SQ) {
                return true;
            }
        }
        return false;
    }

    public getAllPoints(): Point[] {
        let points: Point[] = [];
        if (!isUndef(this.inputPoints)) {
            for (let inputBranch of this.inputPoints!) {
                if (!isUndef(inputBranch) && inputBranch!.length > 0)
                    points.push(...inputBranch!);
            }
        }
        points.push(...this.backbonePoints);
        if (!isUndef(this.outputPoints)) {
            for (let outputBranch of this.outputPoints!) {
                if (!isUndef(outputBranch) && outputBranch!.length > 0)
                    points.push(...outputBranch!);
            }
        }
        if (!isUndef(this.helperPoints)) {
            for (let helperBranch of this.helperPoints!) {
                if (!isUndef(helperBranch) && helperBranch!.length > 0)
                    points.push(...helperBranch!);
            }
        }
        if (!isUndef(this.inhibitorPoints)) {
            for (let inhibitorBranch of this.inhibitorPoints!) {
                if (!isUndef(inhibitorBranch) && inhibitorBranch!.length > 0)
                    points.push(...inhibitorBranch!);
            }
        }
        if (!isUndef(this.activatorPoints)) {
            for (let activatorBranch of this.activatorPoints!) {
                if (!isUndef(activatorBranch) && activatorBranch!.length > 0)
                    points.push(...activatorBranch!);
            }
        }
        return points;
    }

    /**
     * Get the selected Point. This selected Point is picked by method isPicked(Point).
     *
     * @return The selected Point
     */
    public getSelectedPoint(): Maybe<Point> {
        return this.selectionInfo.selectPoint;
    }

    public getConnectWidget(): Maybe<ConnectWidget> {
        let widget: Maybe<ConnectWidget> = this.selectionInfo.connectWidget;
        if (!isUndef(widget) && !isUndef(this.connectInfo)) {
            // Make sure only one widget is created for a single Point
            let oldWidget: Maybe<ConnectWidget> = this.connectInfo!.searchConnectWidget(widget!.getPoint());
            if (!isUndef(oldWidget))
                return oldWidget;
            widget!.setEdge(this);
        }
        return widget;
    }

    public getConnectedNodes(): Node[] {
        const inputNodes: Maybe<Node[]> = this.getInputNodes();
        const outputNodes: Maybe<Node[]> = this.getOutputNodes();
        const helperNodes: Maybe<Node[]> = this.getHelperNodes();
        const activatorNodes: Maybe<Node[]> = this.getActivatorNodes();
        const inhibitorNodes: Maybe<Node[]> = this.getInhibitorNodes();
        const allNodes: Set<Node> = new Set<Node>();

        if (!isUndef(inputNodes))
          inputNodes!.forEach(allNodes.add, allNodes);
        if (!isUndef(outputNodes))
          outputNodes!.forEach(allNodes.add, allNodes);
        if (!isUndef(helperNodes))
          helperNodes!.forEach(allNodes.add, allNodes);
        if (!isUndef(activatorNodes))
          activatorNodes!.forEach(allNodes.add, allNodes);
        if (!isUndef(inhibitorNodes))
          inhibitorNodes!.forEach(allNodes.add, allNodes);

        return Array.from(allNodes);
    }

    public addInputNoParams(): void {
        let inputPoint: Maybe<Point>;
        if (isUndef(this.connectInfo)) {
            return;
        }
        // For update ConnectWidget
        if (isUndef(this.inputPoints) || this.inputPoints!.length == 0) {
            inputPoint = this.getInputHub();
        }
        this.addInputBranch();
        // Branch from zero. ConnectWidget needs to be updated.
        if (!isUndef(inputPoint)) {
            let connectWidget: Maybe<ConnectWidget>= this.connectInfo!.searchConnectWidget(inputPoint!);
            if (!isUndef(connectWidget)) {
                connectWidget!.setControlPoint(this.getInputHub());
            }
        }
    }

    public addInput(node: Node): void {
        if (isUndef(this.connectInfo)) {
            return;
        }
        let inputConnectWidgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getInputWidgets();
        // Search an empty input branch
        let inputP: Point;
        let controlP: Point;
        let index: number = 0;
        if (isUndef(this.inputPoints) || this.inputPoints!.length == 0) {
            if (isUndef(inputConnectWidgets) || inputConnectWidgets.length == 0) { // No input
                inputP = this.getInputHub();
                controlP = this.backbonePoints[1];
                index = 0;
            }
            else { // Create a new input branch.
                this.addInputNoParams();
                let inputBranch: Point[] = this.inputPoints![1];
                index = 1;
                inputP = inputBranch[0] as Point;
                if (inputBranch.length > 1)
                    controlP = inputBranch[1] as Point;
                else
                    controlP = this.getInputHub();
            }
        }
        else {
            // Search if there is an empty slot.
            index = -1; // Mark
            let widget1: ConnectWidget;
            let found: boolean = false;
            for (let i = 0; i < this.inputPoints!.length; i++) {
                // Search if the index i is used
                found = false;
                for (let widget1 of inputConnectWidgets) {
                    if (widget1.getIndex() == i) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    index = i;
                    break;
                }
            }
            if (index != -1) { // There is an empty slot
                let inputBranch: Point[] = this.inputPoints![index];
                inputP = inputBranch[0] as Point;
                if (inputBranch.length > 1)
                    controlP = inputBranch[1] as Point;
                else
                    controlP = this.getInputHub();
            }
            else { // Create a new branch
                this.addInputNoParams();
                let inputBranch: Point[]  = this.inputPoints![this.inputPoints!.length - 1];
                index = this.inputPoints!.length - 1;
                inputP = inputBranch[0] as Point;
                if (inputBranch.length > 1)
                    controlP = inputBranch[1] as Point;
                else
                    controlP = this.getInputHub();
            }
        }
        if (isUndef(node.getPosition()))
            node.setPosition(new Point(inputP.x, inputP.y));
        let widget: ConnectWidget = new ConnectWidget(inputP,
                                                     controlP,
                                                     HyperEdgeConstants.INPUT,
                                                     index);
        widget.setConnectedNode(node);
        widget.setEdge(this);
        widget.doInvalidate();
        widget.connect();
        this.addConnectWidget(widget);
    }

    public removeInput(index: number): void {
        if (index === 0 && (isUndef(this.inputPoints) || this.inputPoints!.length === 0)) {
            // Just disconnect
            this.removeConnectWidgetHE(index, HyperEdgeConstants.INPUT);
            return;
        }
        const inputBranch: Maybe<Point[]> = this.removeInputBranch(index);
        this.removeBranch(inputBranch);
    }

    public addOutputNoParams(): void {
        let outputHub: Maybe<Point>;

        if (isUndef(this.connectInfo)) {
            return;
        }

        // For update ConnectWidget
        if (isUndef(this.outputPoints) || this.outputPoints!.length === 0) {
            outputHub = this.getOutputHub();
        }

        this.addOutputBranch();

        // Branch from zero. ConnectWidget needs to be updated.
        if (!isUndef(outputHub)) {
            let connectWidget: Maybe<ConnectWidget>= this.connectInfo!.searchConnectWidget(outputHub!);
            if (!isUndef(connectWidget)) {
                connectWidget!.setControlPoint(this.getOutputHub());
            }
        }
    }

    /**
     * Check if a selected Point can be removed. A point that is a position attached to a helper branch, a point when
     * there are only two points in the backbone, or the point is the first or last in the backbone or a helper branch
     * cannot be removed.
     *
     * @return true if there is a selected Point and it can be removed; false otherwise
     */
    public isPointRemovable(): boolean {
        if (isUndef(this.selectionInfo.selectPoint))
            return false;
        if (this.selectionInfo.selectPoint == this.position) {
            if (!isUndef(this.helperPoints) && this.helperPoints!.length > 0)
                return false;
            if (!isUndef(this.inhibitorPoints) && this.inhibitorPoints!.length > 0)
                return false;
            if (!isUndef(this.activatorPoints) && this.activatorPoints!.length > 0)
                return false;
        }
        // Cannot remove more if there is only two points in the backbone
        if (this.backbonePoints.length == 2 || isUndef(this.selectionInfo.selectedType))
            return false;
        // Don't remove the first or last point in the backbones or other
        // branches
        let branch: Maybe<Point[][]> = this.getBranchFromType(this.selectionInfo.selectedType!);
        if (this.selectionInfo.selectedType == HyperEdgeConstants.BACKBONE) {
            let index = this.backbonePoints.indexOf(this.selectionInfo.selectPoint!);
            if (index == 0 || index == this.backbonePoints.length - 1)
                return false;
        }
        else {
            // Need to get the actual branch
            if (!isUndef(branch) && branch!.length > 0 && !isUndef(this.selectionInfo.getSelectedBranch())) {
                let branch1: Point[] = branch![this.selectionInfo.getSelectedBranch()!];
                let index = branch1.indexOf(this.selectionInfo.selectPoint!);
                if (index == 0)
                    return false;
            }
        }
        return true;
    }

    public removeSelectedPoint(): void {
        if (!this.isPointRemovable() || isUndef(this.selectionInfo.getSelectedBranch()))
            return;
        let index: number = this.selectionInfo.getSelectedBranch()!;
        let type: Maybe<number> = this.selectionInfo.getSelectedType();
        if (isUndef(type)) {
            return;
        }
        let branch: Maybe<Point[][]> = this.getBranchFromType(type!);
        let points: Point[];
        if (type! === HyperEdgeConstants.BACKBONE)
            points = this.backbonePoints;
        else
            points = branch![index];
        this.removePoint(points, this.selectionInfo.selectPoint);
        this.selectionInfo.selectPoint = undefined;
        this.selectionInfo.selectedBranch = -1;
        this.selectionInfo.selectedType = HyperEdgeConstants.NONE;
        if (type! === HyperEdgeConstants.BACKBONE)
            this.validateAllWidgetControlPoints();
        else
            this.validateWidgetControlPoints(type!);
        this.validatePosition();
    }

    // Remove p from arr
    private removePoint(arr: Point[],
                       p: Maybe<Point>): void {
        if (!isUndef(p)) {
          arr = arr.filter(item => item.equals(p!));
        }
        return;
    }

    /**
     * Make sure the position is still tracked by the object.
     */
    public validatePosition(): void {
        // Make sure the position point is still in the backbone
        if (isUndef(this.position)) {
            return;
        }
        if (!this.backbonePoints.includes(this.position!)) {
            // Pick up the nearest point as the position
            let min: number = Number.MAX_VALUE;
            let candidate: Maybe<Point>;

            // Avoid using the first and last point if possible
            for (let i = 1; i < this.backbonePoints.length - 1; i++) {
                let p: Point = this.backbonePoints[i];
                let distSqr: number = p.distanceSq(this.position!);
                if (distSqr < min) {
                    candidate = p;
                    min = distSqr;
                }
            }

            // Have to use the first or last Point if there are only
            // two points in the backbone. Cannot use the middle point
            // since the two end points may changed during moving.
            if (isUndef(candidate)) {
                candidate = this.backbonePoints[0];
            }

            this.position = candidate;
        } else {
            // Check if position is the first or last point
            let index: number = this.backbonePoints.indexOf(this.position!);

            if ((index === 0 || index === this.backbonePoints.length - 1) &&
                this.backbonePoints.length > 0) {
                // Try to pick up the middle point
                index = Math.floor(this.backbonePoints.length / 2);
                this.position = this.backbonePoints[index];
            }
        }
    }

    /**
     * Add a new bending point to a selected branch or backbone. The position is then validated.
     *
     * @param point Point to add and set as the selected point
     */
    public addPoint(point: Point): void {
        if (isUndef(this.selectionInfo.getSelectedBranch())) {
          return;
        }
        // Make a copy in case this point has been changed
        let copiedPoint: Point = new Point(point.x, point.y);
        let index: number = this.selectionInfo.getSelectedBranch()!;
        let type: Maybe<number> = this.selectionInfo.getSelectedType();
        if (isUndef(type)) {
          return;
        }
        let branch: Maybe<Point[][]> = this.getBranchFromType(type!);
        let points: Point[];
        if (type! == HyperEdgeConstants.BACKBONE)
            points = this.backbonePoints;
        else
            points = branch![index];

        // Need to find where the point should be inserted
        let min: number = Number.MAX_VALUE;
        let insert: number = 0;
        let checking: Point[] = new Array<Point>(...points);
        if (type! != HyperEdgeConstants.BACKBONE) {
            // Need to add the position
            if (!isUndef(this.getPosition())){
                checking.push(this.getPosition()!);
            }
        }
        for (let i = 0; i < checking.length - 1; i++) {
            let p1: Point = checking[i];
            let p2: Point = checking[i + 1];
            // TODO: Commented out temporarily due to lack of Line2D
            // let dist: number = Line2D.ptSegDistSq(p1.x, p1.y, p2.x, p2.y, point.x, point.y);
            let dist: number = 0;
            if (dist < min) {
                min = dist;
                insert = i;
            }
        }
        if (insert == points.length) // Just before the position in case non-backbone points
            points.push(point);
        else
            points.splice(insert + 1, 0, point);

        if (type! == HyperEdgeConstants.BACKBONE)
            this.validateAllWidgetControlPoints();
        else
            this.validateWidgetControlPoints(type!);

        this.selectionInfo.selectPoint = point;

        // Use this method to make sure a new point can be
        // picked up from a two points backbone to three point
        // backbone.
        this.validatePosition();
    }

    /**
     * All control points should be validated
     */
    public validateAllWidgetControlPoints(): void {
        this.validateWidgetControlPoints(HyperEdgeConstants.INPUT);
        this.validateWidgetControlPoints(HyperEdgeConstants.OUTPUT);
        this.validateWidgetControlPoints(HyperEdgeConstants.CATALYST);
        this.validateWidgetControlPoints(HyperEdgeConstants.INHIBITOR);
        this.validateWidgetControlPoints(HyperEdgeConstants.ACTIVATOR);
    }

    public addOutput(node: Node): void {
        // Don't add an empty node
        if (isUndef(node) || isUndef(this.connectInfo))
            return;
        let outputWidgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getOutputWidgets();
        let outputP: Point;
        let controlP: Point;
        let index: number = 0;
        if (isUndef(this.outputPoints) || this.outputPoints!.length == 0) {
            if (isUndef(outputWidgets) || outputWidgets!.length == 0) {// No input
                outputP = this.getOutputHub();
                controlP = this.backbonePoints[this.backbonePoints.length - 2];
                index = 0;
            }
            else { // Create a new input branch.
                this.addOutputNoParams();
                let outputBranch: Maybe<Point[]> = this.outputPoints![1];
                index = 1;
                outputP = outputBranch[0];
                if (!isUndef(outputBranch) && outputBranch!.length > 1)
                    controlP = outputBranch[1];
                else
                    controlP = this.getOutputHub();
            }
        }
        else {
            // Search if there is an empty slot.
            index = -1; // Mark
            let widget1: ConnectWidget;
            let found: boolean = false;
            for (let i = 0; i < this.outputPoints!.length; i++) {
                // Search if the index i is used
                found = false;
                for (let widget1 of outputWidgets) {
                    if (widget1.getIndex() == i) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    index = i;
                    break;
                }
            }
            if (index != -1) { // There is an empty slot
                let outputBranch: Point[] = this.outputPoints![index];
                outputP = outputBranch[0];
                if (outputBranch.length > 1)
                    controlP = outputBranch[1];
                else
                    controlP = this.getOutputHub();
            }
            else { // Create a new branch
                this.addOutputNoParams();
                let outputBranch: Point[] = this.outputPoints![this.outputPoints!.length - 1];
                index = this.outputPoints!.length - 1;
                outputP = outputBranch[0];
                if (outputBranch.length > 1)
                    controlP = outputBranch[1];
                else
                    controlP = this.getOutputHub();
            }
        }
        if (isUndef(node.getPosition()))
            node.setPosition(new Point(outputP.x, outputP.y));
        let widget: ConnectWidget = new ConnectWidget(outputP, controlP, HyperEdgeConstants.OUTPUT, index);
        widget.setConnectedNode(node);
        widget.setEdge(this);
        widget.doInvalidate();
        widget.connect();
        this.addConnectWidget(widget);
    }

    private removeBranch(branch: Maybe<Point[]>): void {
        if (!isUndef(branch) && !isUndef(this.connectInfo)) {
            let p: Point = branch![0];
            let widget: Maybe<ConnectWidget>= this.connectInfo!.searchConnectWidget(p);
            if (!isUndef(widget)) {
                widget!.disconnect();
                this.connectInfo!.removeConnectWidget(widget!);
            }
        }
    }

    public removeOutput(index: number): void {
        if (index === 0 &&
            (isUndef(this.outputPoints) || this.outputPoints!.length === 0)) {
            this.removeConnectWidgetHE(index, HyperEdgeConstants.OUTPUT);
            return;
        }
        let outputBranch: Maybe<Point[]> = this.removeOutputBranch(index);
        this.removeBranch(outputBranch);
    }

    /**
     * Detach a Node from this HyperEdgeConstants.
     *
     * @param node Node to remove from this HyperEdge
     */
    public remove(node: Renderable): void {
        if (!isUndef(this.connectInfo)) {
            return;
        }
        let connectWidgets:Maybe< ConnectWidget[]> = this.connectInfo!.getConnectWidgets();
        if (!isUndef(connectWidgets)) {
            // Remove connecting info.
            let found: ConnectWidget;
            for (let widget of connectWidgets!) {
                if (widget.getConnectedNode() === node) {
                    found = widget;
                    node.removeConnectWidget(widget);
                    break;
                }
            }
            // Now remove found from connectWidgets
            connectWidgets = connectWidgets!.filter(widget => widget === found);
        }
    }

    private removeConnectWidgetHE(index: number, type: number): void {
        if (!isUndef(this.connectInfo)) {
            return;
        }
        const connectWidgets:Maybe< ConnectWidget[]> = this.connectInfo!.getConnectWidgets();
        if (!isUndef(connectWidgets)) {
            // Remove connecting info.
            let found: Maybe< ConnectWidget>;
            for (let widget of connectWidgets!) {
                if (widget.getRole() === type &&
                    widget.getIndex() === index) {
                    found = widget;
                    break;
                }
            }
            if (!isUndef(found)) {
                found!.disconnect();
            }
        }
    }

    removeNodeOfType(node: Renderable, type: number): void {
       switch (type) {
           case HyperEdgeConstants.INPUT:
               let inputNodes: Maybe<Node[]> = this.getInputNodes();
               if (!isUndef(inputNodes)) {
                   let index: number = inputNodes!.indexOf(node as Node);
                   if (index >= 0)
                       this.removeInput(index);
               }
               break;
           case HyperEdgeConstants.OUTPUT:
               let outputNodes: Maybe<Node[]> = this.getOutputNodes();
               if (!isUndef(outputNodes)) {
                   let index = outputNodes!.indexOf(node as Node);
                   if (index >= 0)
                       this.removeOutput(index);
               }
               break;
           case HyperEdgeConstants.CATALYST:
               let helperNodes: Maybe<Node[]> = this.getHelperNodes();
               if (!isUndef(helperNodes)) {
                   let index = helperNodes!.indexOf(node as Node);
                   if (index >= 0)
                       this.removeHelper(index);
               }
               break;
           case HyperEdgeConstants.INHIBITOR:
               let inhibitorNodes: Maybe<Node[]> = this.getInhibitorNodes();
               if (!isUndef(inhibitorNodes)) {
                   let index = inhibitorNodes!.indexOf(node as Node);
                   if (index >= 0)
                       this.removeInhibitor(index);
               }
               break;
           case HyperEdgeConstants.ACTIVATOR:
               let activatorNodes: Maybe<Node[]> = this.getActivatorNodes();
               if (!isUndef(activatorNodes)) {
                   let index = activatorNodes!.indexOf(node as Node);
                   if (index >= 0)
                       this.removeActivator(index);
               }
               break;
       }
   }

   public addHelper(node: Node): void {
       if (isUndef(this.connectInfo)){
            return;
       }
       let helperWidgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getHelperWidgets();
       let helperBranch: Point[] = [];
       let index: number = 0;

       if (isUndef(this.helperPoints) || this.helperPoints!.length === 0) {
           this.addHelperBranch();
           helperBranch = this.helperPoints![0];
           index = 0;
       } else {
           // Search if there is an empty slot.
           index = -1; // Mark
           let widget1: ConnectWidget;
           let found: boolean = false;

           for (let i = 0; i < this.helperPoints!.length; i++) {
               // Search if the index i is used
               found = false;
               for (let widget1 of helperWidgets) {
                   if (widget1.getIndex() == i) {
                       found = true;
                       break;
                   }
               }

               if (!found) {
                   index = i;
                   break;
               }
           }

           if (index != -1) { // There is an empty slot
               helperBranch = this.helperPoints![index];
           } else { // Create a new branch
               this.addHelperBranch();
               helperBranch = this.helperPoints![this.helperPoints!.length - 1];
               index = this.helperPoints!.length - 1;
           }
       }

       this.ensureThreePointsInBackbone();

       let helperP: Point = helperBranch[0];
       let controlP: Maybe<Point>;

       if (helperBranch.length > 1) {
           controlP = helperBranch[1];
       } else {
           controlP = this.getPosition();
       }

       if (isUndef(node.getPosition())) {
           node.setPosition(new Point(helperP.x, helperP.y));
       }

       let widget: ConnectWidget = new ConnectWidget(helperP, controlP, HyperEdgeConstants.CATALYST, index);
       widget.setConnectedNode(node);
       widget.setEdge(this);
       widget.doInvalidate();
       widget.connect();

       this.addConnectWidget(widget);
   }

   /**
    * Make sure there are three points in the backbone so that
    * a helper/inhibitor/activator branch will not attach to
    * the first or last point which is used for input or output.
    */
   private ensureThreePointsInBackbone(): void {
       if (this.backbonePoints.length > 2)
           return;

       // Add a point to backbone
       let p1: Point = this.backbonePoints[0];
       let p2: Point = this.backbonePoints[1];
       let newPoint: Point = new Point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
       this.backbonePoints.splice(1, 0, newPoint);
       this.position = newPoint;

       // Have to validate all control points
       this.validateAllWidgetControlPoints();
   }

   public removeHelper(index: number): void {
       let branch: Maybe<Point[]> = this.removeHelperBranch(index);
       this.removeBranch(branch);
   }

    public addInputBranch(): void {
        // Create a Point for the new inputBranch
        if (isUndef(this.inputPoints) || this.inputPoints!.length == 0) {
            this.inputPoints = new Array<Array<Point>>;
            // Start a new InputBranch from the backbone points.
            let branch: Array<Point> = new Array(1);
            let p: Point = this.getInputHub();
            let ctrlP: Point = this.backbonePoints[1];
            let p1: Point = new Point((ctrlP.x + p.x) / 2, (ctrlP.y + p.y) / 2);
            this.backbonePoints[0] = p1;
            // Original inputHub (first point in the backbone)
            // has been transformed into branch.
            branch.push(p);
            this.inputPoints.push(branch);
            // positions and widget control points may be changed.
            this.validatePosition();
            this.validateAllWidgetControlPoints();
        }
        let inputBranch: Array<Point> = new Array();
        let inputHub: Point = this.getInputHub();
        // Find a good initial position
        let newP: Point = this.generateRandomPoint(this.inputPoints!);
        inputBranch.push(newP);
        this.inputPoints!.push(inputBranch);
        // Make it the default select widget
        this.selectionInfo.selectPoint = newP;
        let index: number = this.inputPoints!.length - 1;
        this.selectionInfo.selectedBranch = index;
        this.selectionInfo.selectedType = HyperEdgeConstants.INPUT;
        this.selectionInfo.connectWidget = new ConnectWidget(newP, this.getInputHub(), HyperEdgeConstants.INPUT, index);
    }

    private generateRandomPoint(branches: Point[][]): Point {
        let minX: number = Number.MAX_VALUE;
        let maxX: number = Number.MIN_VALUE;
        let minY: number = Number.MAX_VALUE;
        let maxY: number = Number.MIN_VALUE;

        for (let i = 0; i < branches.length; i++) {
            const list: Point[] = branches[i];
            const tmpP: Point = list[0];

            if (minX > tmpP.x)
                minX = tmpP.x;
            if (minY > tmpP.y)
                minY = tmpP.y;
            if (maxX < tmpP.x)
                maxX = tmpP.x;
            if (maxY < tmpP.y)
                maxY = tmpP.y;
        }

        // Make 30 as the minimum difference
        let diffX: number = maxX - minX;
        if (diffX < 30)
            diffX = 30;

        let diffY: number = maxY - minY;
        if (diffY < 30)
            diffY = 30;

        let x: number = minX + Math.floor(diffX * Math.random());
        let y: number = minY + Math.floor(diffY * Math.random());

        return new Point(x, y)
    }

    /**
     * Remove an input branch from the inputPoints 2d list at the specified index (if the inputPoints list is null or
     * the index specified is out of bounds, nothing is done).
     *
     * @param index Index value of the inputPoints list at which to remove the input branch
     * @return The removed inputBranch.
     */
    public removeInputBranch(index: number): Maybe<Point[]> {
        if (isUndef(this.inputPoints) || index < 0 || index > this.inputPoints!.length - 1)
            return undefined;

        const branch: Point[] = this.inputPoints![index];
        // Now remove branch from this.inputPoints
        this.inputPoints!.splice(index, 1);

        if (this.inputPoints!.length === 1) {
            // Merge the last branch with the backbone.
            const branch1: Point[] = this.inputPoints![0] as Point[];
            // Remove the first backbone point to do merging.
            const p: Point = this.backbonePoints.shift() as Point;
            // Replace the control point for the connect widgets
            const inputWidgets: ConnectWidget[] = (this.connectInfo as HyperEdgeConnectInfo).getInputWidgets();
            if (!isUndef(inputWidgets) && inputWidgets!.length > 0) {
                let widget: ConnectWidget;
                for (const it of inputWidgets!) {
                    widget = it;
                    if (widget.getControlPoint() === p)
                        widget.setControlPoint(this.backbonePoints[0]);
                }
            }
            for (const it of branch1) {
                this.backbonePoints.unshift(it);
            }
            this.inputPoints = [];
            this.inputPoints = undefined;
            this.validatePosition();
            if (this.selectionInfo.selectedType === HyperEdgeConstants.INPUT)
                this.selectionInfo.selectedType = HyperEdgeConstants.BACKBONE;
        }
        // Have to update index in the ConnectWidget objects
        const inputWidgets: ConnectWidget[] = (this.connectInfo as HyperEdgeConnectInfo).getInputWidgets();
        let widget: ConnectWidget;
        for (const it of inputWidgets) {
            widget = it;
            if (widget.getIndex() >= index)
                widget.setIndex(widget.getIndex() - 1);
        }
        return branch;
    }

    public addOutputBranch(): void {
        // Create a Point for the new OutputBranch
        if (isUndef(this.outputPoints) || this.outputPoints!.length == 0) {
            this.outputPoints = new Array();
            let branch: Array<Point> = new Array();
            let p: Point = this.getOutputHub();
            let ctrlP: Point = this.backbonePoints[this.backbonePoints.length - 2];
            let p1: Point = new Point((ctrlP.x + p.x) / 2, (ctrlP.y + p.y) / 2);
            this.backbonePoints[this.backbonePoints.length - 1] = p1;
            // The original output hub has been transformed into the first output
            // branch.
            branch.push(p);
            this.outputPoints.push(branch);
            // positions and widget control points may be changed.
            this.validatePosition();
            this.validateAllWidgetControlPoints();
        }
        let outputBranch: Array<Point> = new Array();
        let outputHub: Point = this.getOutputHub();
        // Almost random
        let newP: Point = this.generateRandomPoint(this.outputPoints!);
        outputBranch.push(newP);
        this.outputPoints!.push(outputBranch);
        // Make it the default select widget
        this.selectionInfo.selectPoint = newP;
        let index: number = this.outputPoints!.length - 1;
        this.selectionInfo.selectedBranch = index;
        this.selectionInfo.selectedType = HyperEdgeConstants.OUTPUT;
        this.selectionInfo.connectWidget = new ConnectWidget(newP, this.getOutputHub(), HyperEdgeConstants.OUTPUT, index);
    }

    public removeOutputBranch(index: number): Maybe<Point[]> {
        if (isUndef(this.outputPoints) || index < 0 || index > this.outputPoints!.length - 1)
            return undefined;

        const branch: Point[] = this.outputPoints![index];
        // Now remove branch from this.outputPoints
        this.outputPoints!.splice(index, 1);

        if (this.outputPoints!.length === 1) {
            // Merge the last branch with the backbone.
            // Remove the first backbone point to do merging.
            let indexTmp: number = this.backbonePoints.length - 1;
            let p: Point = this.backbonePoints.splice(indexTmp, 1)[0];
            // Replace the control point for the connect widgets
            let outputWidgets: ConnectWidget[] = (this.connectInfo as HyperEdgeConnectInfo).getOutputWidgets();
            if (!isUndef(outputWidgets) && outputWidgets!.length > 0) {
                let widget: ConnectWidget;
                for (let i: number = 0; i < outputWidgets!.length; i++) {
                    widget = outputWidgets![i];
                    if (widget.getControlPoint() === p)
                        widget.setControlPoint(this.backbonePoints[indexTmp - 1]);
                }
            }

            let branch1: Point[] = this.outputPoints![0];
            for (let i: number = 0; i < branch1.length; i++) {
                this.backbonePoints.push(branch1[i]);
            }
            this.outputPoints = [];
            this.outputPoints = undefined;
            this.validatePosition(); // The position may be changed
            if (this.selectionInfo.selectedType === HyperEdgeConstants.OUTPUT)
                this.selectionInfo.selectedType = HyperEdgeConstants.BACKBONE;
        }
        // Have to update index in the ConnectWidget objects
        let outputWidgets: ConnectWidget[] = (this.connectInfo as HyperEdgeConnectInfo).getOutputWidgets();
        let widget: Maybe<ConnectWidget>;
        for (let i: number = 0; i < outputWidgets.length; i++) {
            widget = outputWidgets[i];
            if (widget.getIndex() >= index)
                widget.setIndex(widget.getIndex() - 1);
        }
        return branch;
    }

    /**
     * Create a new helper branch.
     */
    public addHelperBranch(): void {
        let p: Point;
        if (isUndef(this.helperPoints))
            this.helperPoints = new Array();
        if (!isUndef(this.position) && this.helperPoints!.length == 0) {
            let x: number = this.position!.x + (Math.random() * 30);
            let y: number = this.position!.y - 30 + (Math.random() * 60);
            p = new Point(x, y);
        }
        else
            p = this.generateRandomPoint(this.helperPoints!);
        let branch: Array<Point> = new Array();
        branch.push(p);
        this.helperPoints!.push(branch);
        // Make it the default select widget
        this.selectionInfo.selectPoint = p;
        let index: number = this.helperPoints!.length - 1;
        this.selectionInfo.selectedBranch = index;
        this.selectionInfo.selectedType = HyperEdgeConstants.CATALYST;
        this.selectionInfo.connectWidget = new ConnectWidget(p, this.position, HyperEdgeConstants.CATALYST, index);
    }

    removeHelperBranch(index: number): Maybe<Point[]> {
        if (isUndef(this.helperPoints) || index < 0 || index > this.helperPoints!.length - 1)
            return undefined;
        const branch: Point[] = this.helperPoints![index];
        // Now remove branch from this.helperPoints
        this.helperPoints!.splice(index, 1);
        // Have to update ConnectWidgets
        const helperWidgets: ConnectWidget[] = (this.connectInfo as HyperEdgeConnectInfo).getHelperWidgets();
        let widget: Maybe< ConnectWidget>;
        for (let i = 0; i < helperWidgets.length; i++) {
            widget = helperWidgets[i];
            if (widget.getIndex() >= index)
                widget.setIndex(widget.getIndex() - 1);
        }
        return branch;
    }

    /**
     * This method is used to remove a branch in this HyperEdge that is not connected
     * to other node.
     *
     * @param connectWidget ConnectWidget object for finding the type and index for removal
     */
    deleteUnAttachedBranch(connectWidget: ConnectWidget): void {
        const role: number = connectWidget.getRole();
        const index: number = connectWidget.getIndex();
        if (role === HyperEdgeConstants.INPUT)
            this.removeInputBranch(index);
        else if (role === HyperEdgeConstants.OUTPUT)
            this.removeOutputBranch(index);
        else if (role === HyperEdgeConstants.CATALYST)
            this.removeHelperBranch(index);
        else if (role === HyperEdgeConstants.INHIBITOR)
            this.removeInhibitorBranch(index);
        else if (role === HyperEdgeConstants.ACTIVATOR)
            this.removeActivatorBranch(index);
    }

    public hasEmptyInputSlot(): boolean {
        const inputNodes: Maybe<Node[]> = this.getInputNodes();
        if (isUndef(inputNodes) || inputNodes!.length === 0)
            return true;
        if (!isUndef(this.inputPoints) && this.inputPoints!.length > inputNodes!.length)
            return true;
        return false;
    }

    public hasEmptyOutputSlot(): boolean {
        const outputNodes: Maybe<Node[]> = this.getOutputNodes();
        if (isUndef(outputNodes) || outputNodes!.length === 0)
            return true;
        if (!isUndef(this.outputPoints) && this.outputPoints!.length > outputNodes!.length)
            return true;
        return false;
    }

    public hasEmptyHelperSlot(): boolean {
        const helperNodes: Maybe<Node[]> = this.getHelperNodes();
        if (!isUndef(helperNodes) && !isUndef(this.helperPoints) && this.helperPoints!.length > helperNodes!.length)
            return true;
        return false;
    }

    getSelectionInfo(): HyperEdgeSelectionInfo {
        return this.selectionInfo;
    }

    getComponents(): Maybe<Renderable[]> {
        return undefined;
    }

    addInhibitorBranch(): void {
        let p: Point;
        if (isUndef(this.inhibitorPoints))
            this.inhibitorPoints = new Array();
        if (!isUndef(this.position) && this.inhibitorPoints!.length == 0) {
            let x: number = this.position!.x + (30 * Math.random());
            let y: number = this.position!.y - 30 + (60 * Math.random());
             p = new Point(x, y);
        }
        else
            p = this.generateRandomPoint(this.inhibitorPoints!);
        let branch: Point[] = new Array<Point>();
        branch.push(p);
        this.inhibitorPoints!.push(branch);
        // Make it the default select widget
        this.selectionInfo.selectPoint = p;
        let index: number = this.inhibitorPoints!.length - 1;
        this.selectionInfo.selectedBranch = index;
        this.selectionInfo.selectedType = HyperEdgeConstants.CATALYST;
        this.selectionInfo.connectWidget = new ConnectWidget(p, this.position, HyperEdgeConstants.INHIBITOR, index);
    }

    public removeInhibitor(index: number): void {
        const branch: Maybe<Point[]> = this.removeInhibitorBranch(index);
        this.removeBranch(branch);
    }

    public removeInhibitorBranch(index: number): Maybe<Point[]> {
        if (isUndef(this.inhibitorPoints) || index < 0 || index > this.inhibitorPoints!.length - 1) {
            return undefined; // In case
        }

        const branch: Point[] = this.inhibitorPoints![index];
        // Now remove branch from this.inhibitorPoints
        this.inhibitorPoints!.splice(index, 1);

        // Have to update ConnectWidgets
        const inhibitorWidgets: ConnectWidget[] = (this.connectInfo as HyperEdgeConnectInfo).getInhibitorWidgets();
        let widget: Maybe<ConnectWidget>;

        for (let i = 0; i < inhibitorWidgets.length; i++) {
            widget = inhibitorWidgets[i];
            if (widget.getIndex() >= index) {
                widget.setIndex(widget.getIndex() - 1);
            }
        }

        return branch;
    }

    public removeActivator(index: number): void {
        const branch: Maybe<Point[]> = this.removeActivatorBranch(index);
        this.removeBranch(branch);
    }

    public removeActivatorBranch(index: number): Maybe<Point[]> {
        if (isUndef(this.activatorPoints) || index < 0 || index > this.activatorPoints!.length - 1) {
          return undefined; // In case
        }

        const branch: Point[] = this.activatorPoints![index];
        // Now remove branch from this.activatorPoints
        this.activatorPoints!.splice(index, 1);

        // Have to update ConnectWidgets
        const activatorWidgets: ConnectWidget[] = (this.connectInfo as HyperEdgeConnectInfo).getActivatorWidgets();
        let widget: Maybe<ConnectWidget>;

        for (let i = 0; i < activatorWidgets.length; i++) {
          widget = activatorWidgets[i];
          if (widget.getIndex() >= index) {
            widget.setIndex(widget.getIndex() - 1);
          }
        }

        return branch;
    }

    /**
     * Add inhibitor to this HyperEdge
     *
     * @param node Node representing the inhibitor to add
     */
    public addInhibitor(node: Node): void {
        if (isUndef(this.connectInfo)) {
            return;
        }
        let inhibitorWidgets: ConnectWidget[] = (this.connectInfo! as HyperEdgeConnectInfo).getInhibitorWidgets();
        let inhibitorBranch: Point[];
        let index: number = 0;
        if (isUndef(this.inhibitorPoints) || this.inhibitorPoints!.length == 0) {
            this.addInhibitorBranch();
            inhibitorBranch = this.inhibitorPoints![0];
            index = 0;
        }
        else {
            // Search if there is an empty slot.
            index = -1; // Mark
            let widget1: ConnectWidget;
            let found: boolean = false;
            for (let i = 0; i < this.inhibitorPoints!.length; i++) {
                // Search if the index i is used
                found = false;
                for (let widget1 of inhibitorWidgets) {
                    if (widget1.getIndex() == i) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    index = i;
                    break;
                }
            }
            if (index != -1) { // There is an empty slot
                inhibitorBranch = this.inhibitorPoints![index];
            }
            else { // Create a new branch
                this.addInhibitorBranch();
                inhibitorBranch = this.inhibitorPoints![this.inhibitorPoints!.length - 1];
                index = this.inhibitorPoints!.length - 1;
            }
        }
        this.ensureThreePointsInBackbone();
        let inhibitorP: Point = inhibitorBranch[0];
        let controlP: Maybe<Point>;
        if (inhibitorBranch.length > 1)
            controlP = inhibitorBranch[1];
        else
            controlP = this.getPosition();
        if (isUndef(node.getPosition()))
            node.setPosition(new Point(inhibitorP.x, inhibitorP.y));
        let widget: ConnectWidget = new ConnectWidget(inhibitorP, controlP, HyperEdgeConstants.INHIBITOR, index);
        widget.setConnectedNode(node);
        widget.setEdge(this);
        widget.doInvalidate();
        widget.connect();
        this.addConnectWidget(widget);
    }

    getInhibitorPoints(): Maybe<Point[][]> {
        return this.inhibitorPoints;
    }

    setInhibitorPoints(points: Point[][]): void {
        this.inhibitorPoints = points;
    }

    addActivatorBranch(): void {
        let p: Point;
        if (!this.activatorPoints)
            this.activatorPoints = new Array();
        if (!isUndef(this.position) && this.activatorPoints.length === 0) {
            let x: number = this.position!.x + (30 * Math.random());
            let y: number = this.position!.y - 30 + (60 * Math.random());
            p = new Point(x, y);
        }
        else
            p = this.generateRandomPoint(this.activatorPoints);
        let branch: Point[] = new Array();
        branch.push(p);
        this.activatorPoints.push(branch);
        // Make it the default select widget
        this.selectionInfo.selectPoint = p;
        let index: number = this.activatorPoints.length - 1;
        this.selectionInfo.selectedBranch = index;
        this.selectionInfo.selectedType = HyperEdgeConstants.CATALYST;
        this.selectionInfo.connectWidget = new ConnectWidget(p, this.position, HyperEdgeConstants.ACTIVATOR, index);
    }

    public addActivator(node: Node): void {
        if (isUndef(this.connectInfo)) {
            return;
        }
        const activatorWidgets: Array<ConnectWidget> = (this.connectInfo! as HyperEdgeConnectInfo).getActivatorWidgets();
        let activatorBranch: Maybe<Point[]>;
        let index: number = 0;

        if (isUndef(this.activatorPoints) || this.activatorPoints!.length == 0) {
            this.addActivatorBranch();
            activatorBranch = this.activatorPoints![0];
            index = 0;
        } else {
            // Search if there is an empty slot
            index = -1; // Mark
            let widget1: ConnectWidget;
            let found: boolean = false;

            for (let i = 0; i < this.activatorPoints!.length; i++) {
                found = false;

                for (let it of activatorWidgets) {
                    widget1 = it;

                    if (widget1.getIndex() == i) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    index = i;
                    break;
                }
            }

            if (index != -1) { // There is an empty slot
                activatorBranch = this.activatorPoints![index];
            } else { // Create a new branch
                this.addActivatorBranch();
                activatorBranch = this.activatorPoints![this.activatorPoints!.length - 1];
                index = this.activatorPoints!.length - 1;
            }
        }

        this.ensureThreePointsInBackbone();
        const activatorP: Point = activatorBranch[0];
        let controlP: Maybe<Point>;

        if (activatorBranch.length > 1) {
            controlP = activatorBranch[1];
        } else {
            controlP = this.getPosition();
        }

        if (isUndef(node.getPosition())) {
            node.setPosition(new Point(activatorP.x, activatorP.y));
        }

        const widget: ConnectWidget = new ConnectWidget(activatorP, controlP, HyperEdgeConstants.ACTIVATOR, index);
        widget.setConnectedNode(node);
        widget.setEdge(this);
        widget.doInvalidate();
        widget.connect();
        this.addConnectWidget(widget);
    }

    public getActivatorPoints(): Maybe<Point[][]> {
        return this.activatorPoints;
    }

    public setActivatorPoints(points: Point[][]): void {
        this.activatorPoints = points;
    }

    /**
     * Use this method to initialize the position info for a brand new RenderableReaction.
     *
     * @param p Point to use as the position
     */
    public initPosition(p: Point): void {
        this.setPosition(p);
        const inputHub: Point = new Point(p.x - 40, p.y);
        this.setInputHub(inputHub);
        const outputHub: Point = new Point(p.x + 40, p.y);
        this.setOutputHub(outputHub);
        this.needCheckBounds = true;
    }

    public validateConnectInfo(): void {
        if (!isUndef(this.connectInfo)) {
            this.connectInfo!.validate();
        }
    }

    public override getBounds(): Maybe<Rectangle> {
        if (this.needCheckBounds)
            this.validateBounds();
        return this.bounds;
    }

    public validateBounds(): void {
        // Reset the bounds
        if (isUndef(this.position) || isUndef(this.bounds)) {
          return;
        }
        this.bounds!.x = this.position!.x;
        this.bounds!.y = this.position!.y;
        this.bounds!.width = 5; // Minimum
        this.bounds!.height = 5; // Minimum
        let p: Maybe<Point>;
        // Get all points related to this edge to do checking
        const points: Point[] = [];
        points.push(...this.backbonePoints);
        if (!isUndef(this.inputPoints)) {
            for (const inputList of this.inputPoints!) {
                points.push(...inputList);
            }
        }
        if (!isUndef(this.outputPoints)) {
            for (const outputList of this.outputPoints!) {
                points.push(...outputList);
            }
        }
        if (!isUndef(this.helperPoints)) {
            for (const helperList of this.helperPoints!) {
                points.push(...helperList);
            }
        }
        if (!isUndef(this.inhibitorPoints)) {
            for (const inhibitorList of this.inhibitorPoints!) {
                points.push(...inhibitorList);
            }
        }
        if (!isUndef(this.activatorPoints)) {
            for (const activatorList of this.activatorPoints!) {
                points.push(...activatorList);
            }
        }
        for (const point of points) {
            p = point;
            if (p.x > this.bounds!.width + this.bounds!.x) {
                this.bounds!.width = p.x - this.bounds!.x;
            } else if (p.x < this.bounds!.x) {
                this.bounds!.width += (this.bounds!.x - p.x);
                this.bounds!.x = p.x;
            }
            if (p.y > this.bounds!.height + this.bounds!.y) {
                this.bounds!.height = p.y - this.bounds!.y;
            } else if (p.y < this.bounds!.y) {
                this.bounds!.height += (this.bounds!.y - p.y);
                this.bounds!.y = p.y;
            }
        }
        this.needCheckBounds = false;
    }

    public getType(): string {
        return "Hyperedge";
    }

    public getLinkWidgetPositions(): Maybe<Point[]> {
        return undefined;
    }

    /**
     * This is a simple version of isPicked(Point) to check if the input or output hub is picked.
     * An input or output hub in the end point of a FlowLine object.
     *
     * @param p Point to check
     * @return true if this HyperEdge object is selected and the point passed is picked; false otherwise
     */
    public isPointPicked(p: Point): boolean {
        if (!this.getIsSelected()) { // Make sure this edge is selected.
            return false;
        }
        return this.canPointBePicked(p);
    }
}
