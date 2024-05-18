/**
  This is a stub class for java.awt.Point used in CuratorTool
 */

import { Point } from './Point';

export class Rectangle {
    x: number = 0;
    y: number = 0;
    width: number = 0;
    height: number = 0;

    constructor(x: number, y: number, width: number, height: number) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }

    contains(p: Point | undefined): boolean {
      if (p !== undefined) {
        return p.x >= this.x && p.x <= this.x + this.width && p.y >= this.y && p.y <= this.y + this.height;
      }
      return false;
    }

    containsRectangle(r: Rectangle | undefined): boolean {
      if (r !== undefined) {
        return r.x >= this.x && r.x + r.width <= this.x + this.width && r.y >= this.y && r.y + r.height <= this.y + this.height;
      }
      return false;
    }

    public getHeight() {
      return this.height;
    }

    public getWidth() {
      return this.width;
    }

    public getMaxX(): number {
      return this.x + this.width;
    }

    public getMaxY(): number {
      return this.y + this.height;
    }

    public getCenterX(): number {
      return (this.x + this.width) / 2;
    }

    public getCenterY(): number {
      return (this.y + this.height) / 2;
    }

    public translate(dx: number, dy: number): void {
      this.x += dx;
      this.y += dy;
    }

}
