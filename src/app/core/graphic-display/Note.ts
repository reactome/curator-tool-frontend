import { Renderable } from './Renderable';
import { ConnectWidget } from './ConnectWidget';
import { Node } from './Node';
import { Maybe, isUndef } from './Utils';

export class Note extends Node {
    // A private Note will not be shown in a deployed diagram for the public.
    private isPrivate: boolean = false;

    constructor() {
        super(undefined);
        this.isLinkable = false;
        this.isTransferrable = true;
    }

    public override getType(): string {
        return "Note";
    }

    public override validateConnectWidget(widget: ConnectWidget): void {
        // Do nothing
    }

    public getIsPrivate(): boolean {
        return this.isPrivate;
    }

    public setPrivate(isPrivate: boolean): void {
        this.isPrivate = isPrivate;
    }

    /**
     * Disable this method so that nothing is returned.
     */
    public override generateShortcut(): Maybe<Renderable> {
        return undefined;
    }
}
