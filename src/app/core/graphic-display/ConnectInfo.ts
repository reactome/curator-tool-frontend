import { ConnectWidget } from './ConnectWidget';
import { Point } from './Point';
import { HyperEdge } from './HyperEdge';
import { Maybe, isUndef } from './Utils';

export abstract class ConnectInfo {
    protected connectWidgets?: ConnectWidget[];

    constructor() {
    }

    public setConnectWidgets(widgets: Maybe<ConnectWidget[]>){
        this.connectWidgets = widgets;
    }

    public getConnectWidgets(): Maybe<ConnectWidget[]> {
        return this.connectWidgets;
    }

    public addConnectWidget(widget: ConnectWidget) {
        if (isUndef(this.connectWidgets))
            this.connectWidgets = [];
        if (!this.connectWidgets!.includes(widget))
            this.connectWidgets!.push(widget);
    }

    public removeConnectWidget(widget: ConnectWidget) {
        if (!isUndef(this.connectWidgets))
            this.connectWidgets = this.connectWidgets!.filter(w => w !== widget);
    }

    public searchConnectWidget(p: Point): Maybe<ConnectWidget> {
        if (!isUndef(this.connectWidgets))
            for (let widget of this.connectWidgets!) {
                if (widget.getPoint() == p)
                    return widget;
            }
        return undefined;
    }

    public invalidate() {
        if (!isUndef(this.connectWidgets)) {
            let edge: Maybe<HyperEdge>;
            for (let widget of this.connectWidgets!) {
                if (widget.isInvalidate())
                    continue;
                widget.doInvalidate();
                edge = widget.getEdge();
                // Have to invalidate both ends
                if (!isUndef(edge) && edge!.getBackbonePoints().length == 2 && !isUndef(edge!.getConnectInfo())) {
                    edge!.getConnectInfo()!.invalidate();
                }
            }
        }
    }

    public validate() {
        if (isUndef(this.connectWidgets))
            return;
        for (let widget of this.connectWidgets!) {
            widget.validate();
        }
    }

    public abstract clear(): void;
}


