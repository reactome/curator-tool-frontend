import { ConnectInfo } from './ConnectInfo';
import { Maybe, isUndef } from './Utils';

export class NodeConnectInfo extends ConnectInfo {

    constructor() {
        super();
    }

    clear() {
        if (!isUndef(this.connectWidgets)) {
            for (let widget of this.connectWidgets!) {
                let edge = widget.getEdge();
                if (!isUndef(edge)) {
                    edge!.removeConnectWidget(widget);
                    // Don't want to keep any unused branch
                    edge!.deleteUnAttachedBranch(widget);
                }
            }
            this.connectWidgets = undefined;
        }
    }

}
