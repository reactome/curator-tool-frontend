import { Point } from './Point';
import { HyperEdge } from './HyperEdge';
import { ConnectWidget } from './ConnectWidget';

export class HyperEdgeSelectionInfo {
    selectPoint: Point | undefined;
    connectWidget: ConnectWidget | undefined;
    selectedType: number | undefined; // One of input, helper, and output.
    selectedBranch: number | undefined;

    constructor() {
    }

    getSelectedType(): number | undefined {
        return this.selectedType;
    }

    getSelectedBranch(): number | undefined{
        return this.selectedBranch;
    }

    reset(): void {
        this.selectPoint = undefined;
        this.connectWidget = undefined;
        this.selectedType = HyperEdge.NONE;
        this.selectedBranch = -1;
    }

    setSelectionPoint(p: Point | undefined): void {
        this.selectPoint = p;
    }

    getSelectPoint(): Point | undefined {
        return this.selectPoint;
    }
}

