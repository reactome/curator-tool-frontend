/**
  This is a stub class for java.awt.Color used in CuratorTool
 */
export class Color {
    r: number;
    g: number;
    b: number;
    alpha: number = 0;

    constructor(r: number, g: number, b: number, alpha: number | undefined) {
        this.r = r;
        this.g = g;
        this.b = b;
        if (alpha !== undefined) {
          this.alpha = alpha;
        }
    }
}
