import { NodeAttachment } from './NodeAttachment';

/**
 * This class is used to describe state information for Node (Protein or other macromolecules).
 * For example, active, open, close state. For in the current implementation of RenderableState,
 * label and description should be the same.
 *
 */
export class RenderableState extends NodeAttachment {
    private desc: string | undefined;

    constructor() {
        super();
        this.textPadding = 4;
    }

    public override getDescription(): string | undefined {
        return this.desc;
    }

    public override getLabel(): string | undefined {
        return this.desc;
    }

    public override setDescription(description: string): void {
        this.desc = description;
    }

    public override setLabel(label: string): void {
        this.desc = label;
    }

    public override duplicate(): NodeAttachment {
        const clone = new RenderableState();
        clone.desc = this.desc;
        clone.setRelativePosition(this.relativeX!, this.relativeY!);
        clone.setTrackId(this.trackId!);
        return clone as NodeAttachment;
    }
}
