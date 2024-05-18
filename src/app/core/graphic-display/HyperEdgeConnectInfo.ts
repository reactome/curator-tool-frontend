import { ConnectWidget } from './ConnectWidget';
import { ConnectInfo } from './ConnectInfo';
import { Renderable } from './Renderable';
import { Rectangle } from './Rectangle';
import { Point } from './Point';
import { Node } from './Node';
import { Maybe, isUndef } from './Utils';
import { HyperEdgeConstants } from './HyperEdgeConstants';

/**
 * This class holds information related to a Reaction connecting to other nodes
 (i.e., Entities, Complexes, or Pathways).
 */
export class HyperEdgeConnectInfo extends ConnectInfo {

    /**
     * Creates a new instance of ReactionConnectInfo
     */
    constructor() {
        super();
    }

    /**
     * Get a list of ConnectWidgets that are used for input entities.
     *
     * @return List of ConnectWidget objects representing the inputs
     */
    getInputWidgets(): ConnectWidget[] {
        const inputs: ConnectWidget[] = [];
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                if (widget.getRole() == HyperEdgeConstants.INPUT) {
                    inputs.push(widget);
                }
            }
        }
        return inputs;
    }

    /**
     * Get a list of ConnectWidgets that are used for output entities.
     *
     * @return List of ConnectWidget objects representing the outputs
     */
    getOutputWidgets(): Array<ConnectWidget> {
        const outputs: Array<ConnectWidget> = new Array();
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                if (widget.getRole() == HyperEdgeConstants.OUTPUT) {
                    outputs.push(widget);
                }
            }
        }
        return outputs;
    }

    /**
     * Get a list of ConnectWidgets that are used for helper entities.
     *
     * @return List of ConnectWidget objects representing the helpers (i.e. catalysts)
     */
    public getHelperWidgets(): ConnectWidget[] {
        const helpers: ConnectWidget[] = [];
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                if (widget.getRole() === HyperEdgeConstants.CATALYST) {
                    helpers.push(widget);
                }
            }
        }
        return helpers;
    }

    /**
     * Get a list of ConnectWidgets that are used for inhibitors.
     *
     * @return List of ConnectWidget objects representing the inhibitors
     */
    public getInhibitorWidgets(): ConnectWidget[] {
        const inhibitors: ConnectWidget[] = [];
        if (!isUndef(this.connectWidgets)) {
            for (const widget of this.connectWidgets!) {
                if (widget.getRole() === HyperEdgeConstants.INHIBITOR) {
                    inhibitors.push(widget);
                }
            }
        }
        return inhibitors;
    }

    /**
     * Get a list of ConnectWidgets for activators.
     *
     * @return List of ConnectWidget objects representing the activators
     */
    public getActivatorWidgets(): ConnectWidget[] {
        const activators: ConnectWidget[] = [];
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                if (widget.getRole() === HyperEdgeConstants.ACTIVATOR) {
                    activators.push(widget);
                }
            }
        }
        return activators;
    }

    /**
     * Get the ConnectWidget that is used to connect renderable.
     *
     * @param renderable Renderable object for which to find the ConnectWidget object with an input role
     * @return ConnectWidget object which is an input and connected to the renderable passed
     */
    public getInputConnectWidget(renderable: Renderable): Maybe<ConnectWidget> {
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                if (widget.getRole() == HyperEdgeConstants.INPUT &&
                    widget.getConnectedNode() == renderable)
                    return widget;
            }
        }
        return undefined;
    }

    /**
     * Get the ConnectWidget that is used to connect a specified output renderable.
     *
     * @param renderable Renderable object for which to find the ConnectWidget object with an output role
     * @return ConnectWidget object which is an output and connected to the renderable
     */
    public getOutputConnectWidget(renderable: Renderable): Maybe<ConnectWidget> {
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                if (widget.getRole() == HyperEdgeConstants.OUTPUT &&
                    widget.getConnectedNode() == renderable)
                    return widget;
            }
        }
        return undefined;
    }

    public getConnectWidget(node: Renderable): Maybe<ConnectWidget> {
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                if (widget.getConnectedNode() == node)
                    return widget;
            }
        }
        return undefined;
    }

    public clear(): void {
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                if (!isUndef(widget.getConnectedNode())) {
                  widget.getConnectedNode()!.removeConnectWidget(widget);
                }
            }
            this.connectWidgets = undefined;
        }
    }

    public override validate(): void {
        super.validate();
        if (isUndef(this.connectWidgets) || this.connectWidgets!.length == 0)
            return;

        // Split a little bit for inputs greater than 1
        const nodeToWidget: Map<Node, ConnectWidget[]> = new Map();

        for (const widget of this.connectWidgets!) {
            const node: Maybe<Node> = widget.getConnectedNode();

            if (isUndef(node))
                continue;

            let list: Maybe<ConnectWidget[]> = nodeToWidget.get(node!);

            if (isUndef(list)) {
                list = [];
                nodeToWidget.set(node!, list);
            }

            list!.push(widget);
        }

        for (const node of nodeToWidget.keys()) {
            const list: Maybe<ConnectWidget[]> = nodeToWidget.get(node);
            if (isUndef(list) || list!.length == 1)
                continue;

            if (!this.isJiggleNeeded(list!))
                continue;

            const bounds: Maybe<Rectangle> = node.getBounds();
            const widget: ConnectWidget = list![0];
            const p: Point = widget.getPoint();

            if (!isUndef(bounds)) {
                if (p.x > bounds!.x && p.x < bounds!.getMaxX())
                    this.jiggleX(list!, bounds!);
                else
                    this.jiggleY(list!, bounds!);
            }
        }
    }

    private isJiggleNeeded(widgets: ConnectWidget[]): boolean {
        const widget1: ConnectWidget = widgets[0];
        const widget2: ConnectWidget = widgets[1];

        return widget1.getPoint().equals(widget2.getPoint());
    }

    private jiggleX(widgets: ConnectWidget[], bounds: Rectangle): void {
        let widget: Maybe<ConnectWidget>;
        let p: Maybe<Point>;
        let step: number = 7;
        let c: number = widgets.length;
        let start: number = -Math.floor(c / 2);

        for (let i = 0; i < c; i++) {
            widget = widgets[i];
            p = widget.getPoint();
            p.x += start * step;

            if (p.x < bounds.x)
                p.x = bounds.x;

            if (p.x > bounds.getMaxX())
                p.x = bounds.getMaxX();

            start++;
        }
    }

    private jiggleY(widgets: ConnectWidget[], bounds: Rectangle): void {
        let widget: Maybe<ConnectWidget>;
        let p: Maybe<Point>
        let step: number = 7;
        let c: number = widgets.length;
        let start: number = -c / 2;
        for (let i = 0; i < c; i++) {
            widget = widgets[i];
            p = widget.getPoint();
            p.y += start * step;
            if (p.y < bounds.y)
                p.y = bounds.y;
            if (p.y > bounds.getMaxY())
                p.y = bounds.getMaxY();
            start++;
        }
    }
}
