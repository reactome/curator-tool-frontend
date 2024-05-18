import { NodeAttachment } from './NodeAttachment';
import { Rectangle } from './Rectangle';
import { Maybe, isUndef } from './Utils';

/**
 * A simple algorithm to layout NodeAttachment objects evenly on a Node
 * provided by its bounding information.
 *
 */
export class NodeAttachmentAutoLayout {
    private readonly BUFFER: number = 10.0;

    /**
     * Default constructor.
     */
    constructor() {
    }

    public layout(attachments: NodeAttachment[],
                  w: number,
                  h: number): void {
        if (isUndef(attachments))
            return; // No need to do anything
        this.simpleLayout(attachments, w, h); // As suggested by Steve, arrange all modifications from top-left corner.
    }

    private calculateBuffer(attachments: NodeAttachment[],
                            w: number,
                            h: number,
                            space: number): number {
        let buffer: number = this.BUFFER * 2.0; // Give extra pixels to four corners
        while (true) {
            buffer /= 2.0;
            if (buffer < 1.0)
                break;
            let totalLength: number = space * attachments.length;
            for (let att of attachments) {
                let bounds: Maybe<Rectangle> = att.getBounds();
                if (!isUndef(bounds))
                    totalLength += bounds!.getWidth();
            }
            let nodeLength: number = 2.0 * (w + h) - 8 * buffer;
            if (nodeLength >= totalLength)
                return buffer;
        }
        return 0.0;
    }

    /**
     * Layout nodes one by one starting from the top-left corner.
     * @param attachments List of node attachments
     * @param w Width of the layout
     * @param h Height of the layout
     */
    private simpleLayout(attachments: NodeAttachment[], w: number, h: number): void {
        if (!attachments || attachments.length === 0) {
            return;
        }

        let space: number = 4.0;
        let buffer: number = this.calculateBuffer(attachments, w, h, space);

        if (buffer < this.BUFFER) {
            this.edgeLayout(attachments, w, h, buffer);
            return;
        }

        // Start from top-right corner
        let prevLength: number = this.BUFFER;
        let phase: number = 0; // Four cases: 0, north; 1: east, 2: south, 3: west
        let oldPhase: number = phase;

        for (let i = 0; i < attachments.length; i++) {
            let attachment: NodeAttachment = attachments[i];
            let bounds: Maybe<Rectangle> = attachment.getBounds();
            if (!isUndef(bounds)) {
                oldPhase = phase;
                phase = this.determinePhase(phase, prevLength, bounds!, w, h, buffer);

                if (oldPhase !== phase) {
                    prevLength = buffer; // Start a new phase
                }

                this.calculatePositionWithPhase(attachment, bounds!, phase, prevLength, w, h);

                if (phase === 0 || phase === 2) {
                    prevLength += (bounds!.getWidth() + space);
                } else {
                    prevLength += (bounds!.getHeight() + space);
                }
            }
        }
    }

    private calculatePositionWithPhase(attachment: NodeAttachment, bounds: Rectangle, phase: number, prevLength: number, w: number, h: number) {
        let x: number, y: number;
        switch (phase) {
            case 0 :
                x = (prevLength + bounds.getWidth() / 2.0) / w;
                y = 0.0;
                break;
            case 1 :
                x = 1.0;
                y = (prevLength + bounds.getHeight() / 2.0) / h;
                break;
            case 2 :
                x = (prevLength + bounds.getWidth() / 2.0); // Calculate from right to left
                x = (w - x) / w;
                y = 1.0;
                break;
            default : // Case 3
                x = 0.0;
                y = (prevLength + bounds.getHeight() / 2.0); // From bottom to up
                y = (h - y) / h;
        }
        attachment.setRelativePosition(x, y);
    }

    private determinePhase(currentPhase: number, prevLength: number, bounds: Rectangle, w: number, h: number, buffer: number): number {
        switch (currentPhase) {
            case 0: case 2:
                if (prevLength + bounds.getWidth() > w - buffer)
                    return ++currentPhase;
                else
                    return currentPhase;
            case 1:
                if (prevLength + bounds.getHeight() > h - buffer)
                    return 2;
                else
                    return 1;
            default:
                return currentPhase; // Default
        }
    }

    /**
     * Layout evenly around the edges. The implementation here needs a little bit more work
     * for attachments around the corner which may not be nice.
     * @param attachments
     * @param w
     * @param h
     */
    private edgeLayout(attachments: NodeAttachment[], w: number, h: number, buffer: number): void {
        if (isUndef(attachments) || attachments!.length == 0)
            return;
        let length: number = 2.0 * (w + h) - 8 * buffer;
        let step: number = length / attachments.length; // Give it extra space
        for (let i = 0; i < attachments.length; i++) {
            let attachment: NodeAttachment = attachments[i];
            let tmp: number = step * i;
            if (tmp < w - buffer) // Give it an extra space so that it will not occupy the corner position
                attachment.setRelativePosition((tmp + buffer) / w, 0);
            else if (tmp < (w + h - 3 * buffer))
                attachment.setRelativePosition(1, (tmp - w + 3 * buffer) / h);
            else if (tmp < (2 * w + h - 5 * buffer))
                attachment.setRelativePosition((w - (tmp - w - h + 5 * buffer)) / w, 1);
            else
                attachment.setRelativePosition(0, (h - (tmp - 2.0 * w - h + 7 * buffer)) / h);
        }
    }

    // Layout a list of attachments nicely in a rectangle specified by width and height.
    // @param attachments
    // @param w width
    // @param h height
    private radialLayout(attachments: NodeAttachment[], w: number, h: number): void {
        // If there is only one attachment, for sure we don't need to do anything.
        if (isUndef(attachments) || attachments!.length == 0)
            return; // Nothing needs to be done
        // Using a circle and evenly divide it into multiple angles to calculate
        // the relative coordinates for each attachment.
        let step: number = 2.0 * Math.PI / attachments.length;
        for (let i = 0; i < attachments.length; i++) {
            let attachment: NodeAttachment = attachments[i];
            let alpha: number = (i + 1) * step; // Start with 40 degree to avoid interfering the edge connection
            this.calculatePositionWithAlpha(attachment, alpha, w, h);
        }
    }

    private calculatePositionWithAlpha(attachment: NodeAttachment, alpha: number, w: number, h: number): void {
        let tan: number = Math.tan(alpha);
        // Use the center of the rectangle as the origin of the coordinate system
        // Assume the position should be in one of two horizontal edges
        let x: number, y: number; // the coordinate relate to the origin
        if (alpha < Math.PI)
            y = h / 2.0;
        else
            y = -h / 2.0;
        // Calculate x
        x = y / tan;
        if (Math.abs(x) > w / 2.0) {
            // The position should be in one of two vertical edges
            if (alpha < Math.PI * 0.5 || alpha > 1.5 * Math.PI)
                x = w / 2.0;
            else
                x = -w / 2.0;
            y = x * tan;
        }
        // Shift the origin to top-left corner
        x += w / 2.0;
        y = h / 2.0 - y;
        // We need to have relative coordinates
        attachment.setRelativePosition(x / w, y / h);
    }
}
