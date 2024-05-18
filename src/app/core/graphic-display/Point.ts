/**
  This is a stub class for java.awt.Graphics used in CuratorTool
 */
export class Point {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    public equals(p: Point): boolean {
      return p.x === this.x && p.y === this.y;
    }

    public distanceSq(p: Point): number {
      return 0;
    }
}
