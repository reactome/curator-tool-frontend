/**
 * Navigation overlays for the pathway diagram: a thumbnail of the whole diagram
 * with the current viewport drawn on it, and a wheel of pan / fit-to-screen
 * buttons.
 *
 * Ported from the public pathway browser, where DiagramComponent owns both in
 * its own template. Here the diagram comes from the ngx-reactome-diagram
 * library, so the overlays sit outside it and drive the cytoscape instance the
 * library exposes -- attach() hands them that instance and its container.
 */
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BoundingBoxWH, Core } from 'cytoscape';

// How far one press of an arrow button pans the diagram, in rendered pixels.
const PAN_DISTANCE = 50;
// Padding left around the diagram when fitting it to the screen.
const FIT_PADDING = 100;
// The viewport rectangle's corner radius shrinks from INIT_RX at min zoom to
// END_RX at max zoom, so it stays a recognizable shape as it gets smaller.
const INIT_RX = 2;
const END_RX = 0;
// Height of the image cytoscape renders for the thumbnail. Small enough to be
// cheap to produce, large enough not to look blurry at the 70px it is shown at.
const THUMBNAIL_MAX_HEIGHT = 240;

@Component({
  selector: 'app-diagram-navigator',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './diagram-navigator.component.html',
  styleUrl: './diagram-navigator.component.scss'
})
export class DiagramNavigatorComponent implements OnDestroy {
  @ViewChild('thumbnail')
  private thumbnailRef?: ElementRef<HTMLImageElement>;

  // The rendered diagram, as a data URL. Empty until a diagram is attached,
  // which is also what keeps the thumbnail out of the DOM entirely.
  readonly thumbnailImg = signal<string>('');
  readonly thumbnailSize = signal<{ width: number, height: number }>({ width: 0, height: 0 });

  private readonly containerSize = signal<{ width: number, height: number }>({ width: 0, height: 0 });
  private readonly boundingBox = signal<BoundingBoxWH>({ x1: 0, y1: 0, w: 1, h: 1 });
  private readonly viewportPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 });
  private readonly zoomLevel = signal<number>(0.1);
  private readonly minZoom = signal<number>(0.1);
  private readonly maxZoom = signal<number>(15);

  private cy?: Core;
  private container?: HTMLElement;
  private sizeObserver?: ResizeObserver;
  private refreshHandle?: ReturnType<typeof setTimeout>;

  readonly thumbnailViewBox = computed(() => `0 0 ${this.thumbnailSize().width} ${this.thumbnailSize().height}`);

  private readonly thumbnailRxA = computed(() => (END_RX - INIT_RX) / (this.maxZoom() - this.minZoom()));
  private readonly thumbnailRxB = computed(() => INIT_RX - this.thumbnailRxA() * this.minZoom());
  readonly thumbnailRx = computed(() => this.zoomLevel() * this.thumbnailRxA() + this.thumbnailRxB());

  /**
   * Where the current viewport falls on the thumbnail, in thumbnail pixels.
   *
   * panFromThumbnail() is the inverse of this mapping. Keep the two in step: if
   * the scale or the centring offset changes in one, the rectangle and the
   * pointer stop agreeing about where the user is pointing.
   */
  readonly shrunkViewport = computed(() => {
    const bbox = this.boundingBox();
    const zoom = this.zoomLevel();
    const pan = this.viewportPosition();

    const mainWidth = this.containerSize().width;
    const mainHeight = this.containerSize().height;

    const thumbWidth = this.thumbnailSize().width;
    const thumbHeight = this.thumbnailSize().height;

    // Uniform scaling, so the diagram keeps its aspect ratio in the thumbnail.
    const scale = Math.min(thumbWidth / bbox.w, thumbHeight / bbox.h);

    // Offset to centre the diagram in the thumbnail.
    const offsetX = (thumbWidth - bbox.w * scale) / 2;
    const offsetY = (thumbHeight - bbox.h * scale) / 2;

    // The viewport in graph coordinates, then converted to thumbnail pixels.
    return {
      x: (-pan.x / zoom - bbox.x1) * scale + offsetX,
      y: (-pan.y / zoom - bbox.y1) * scale + offsetY,
      width: (mainWidth / zoom) * scale,
      height: (mainHeight / zoom) * scale
    };
  });

  /**
   * Point the overlays at a diagram.
   *
   * Called whenever a diagram finishes displaying: the library builds a fresh
   * cytoscape instance each time, so the previous one's listeners go with it
   * and only the ResizeObserver has to be moved across.
   */
  attach(cy: Core, container: HTMLElement) {
    this.cy = cy;
    if (this.container !== container) {
      if (this.container) this.sizeObserver?.unobserve(this.container);
      this.container = container;
      this.observe(container);
    }
    this.containerSize.set({ width: container.clientWidth, height: container.clientHeight });

    cy.on('viewport', () => {
      this.zoomLevel.set(cy.zoom());
      this.viewportPosition.set({ ...cy.pan() });
    });

    this.zoomLevel.set(cy.zoom());
    this.minZoom.set(cy.minZoom());
    this.maxZoom.set(cy.maxZoom());
    this.viewportPosition.set({ ...cy.pan() });
    this.refreshThumbnail();
  }

  /**
   * Redraw the thumbnail from the diagram as it now stands.
   *
   * The curator tool edits diagrams, so unlike the public browser the picture
   * goes stale. Rendering it is a full png() of the graph, so the delay both
   * gives cytoscape a beat to finish drawing -- a png() taken in the same tick
   * as a load can come back blank -- and coalesces the flood of calls that a
   * drag produces into one render once the gesture settles.
   */
  refreshThumbnail(delayMs = 5) {
    const cy = this.cy;
    if (!cy) return;

    clearTimeout(this.refreshHandle);
    this.refreshHandle = setTimeout(() => {
      if (cy !== this.cy || cy.destroyed()) return;
      if (cy.elements().length === 0) {
        this.thumbnailImg.set('');
        return;
      }

      this.boundingBox.set(cy.elements().boundingBox({
        includeEdges: true,
        includeNodes: true,
        includeLabels: false,
        includeMainLabels: false,
        includeOverlays: false,
        includeSourceLabels: false,
        includeTargetLabels: false
      }));
      this.thumbnailImg.set(cy.png({ full: true, maxHeight: THUMBNAIL_MAX_HEIGHT }));
    }, delayMs);
  }

  ngOnDestroy(): void {
    clearTimeout(this.refreshHandle);
    this.sizeObserver?.disconnect();
  }

  /**
   * Drag state for the thumbnail. Panning follows the pointer once pressed, so
   * the whole gesture is one press-move-release rather than repeated clicks.
   *
   * Deliberately no setPointerCapture: capturing on pointerdown and releasing
   * on pointerup leaks the capture whenever the release does not arrive on the
   * same element, and a retained capture retargets every later pointer event to
   * the thumbnail -- which silently kills right-click, selection and hovering
   * across the whole diagram. Tracking the drag on the window instead cannot
   * leave that behind.
   */
  private thumbnailDragging = false;

  onThumbnailPointerDown(event: PointerEvent) {
    event.preventDefault();
    this.thumbnailDragging = true;
    this.panFromThumbnail(event);
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent) {
    if (this.thumbnailDragging) this.panFromThumbnail(event);
  }

  @HostListener('window:pointerup')
  @HostListener('window:pointercancel')
  endThumbnailDrag() {
    this.thumbnailDragging = false;
  }

  thumbnailLoaded() {
    const thumbnail = this.thumbnailRef?.nativeElement;
    if (!thumbnail) return;
    this.thumbnailSize.set(thumbnail.getBoundingClientRect());
    this.observe(thumbnail);
  }

  move(direction: 'up' | 'right' | 'down' | 'left') {
    const x = direction === 'right' ? -PAN_DISTANCE : direction === 'left' ? PAN_DISTANCE : 0;
    const y = direction === 'up' ? PAN_DISTANCE : direction === 'down' ? -PAN_DISTANCE : 0;
    this.cy?.panBy({ x, y });
  }

  fitScreen() {
    this.cy?.animate({
      fit: { eles: '*', padding: FIT_PADDING },
      duration: 1000,
      easing: 'ease-in-out'
    });
  }

  private observe(element: Element) {
    if (!this.sizeObserver) {
      this.sizeObserver = new ResizeObserver(entries => {
        entries.forEach(entry => {
          if (entry.target === this.container)
            this.containerSize.set(entry.contentRect);
          else if (entry.target === this.thumbnailRef?.nativeElement)
            this.thumbnailSize.set(entry.contentRect);
        });
      });
    }
    this.sizeObserver.observe(element);
  }

  /** Centre the diagram on the point pressed in the thumbnail. */
  private panFromThumbnail(event: PointerEvent) {
    const cy = this.cy;
    const image = this.thumbnailRef?.nativeElement;
    if (!cy || !image) return;

    const bbox = this.boundingBox();
    if (!bbox.w || !bbox.h) return;

    const { width: thumbWidth, height: thumbHeight } = this.thumbnailSize();
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // thumbnailSize comes from a ResizeObserver on the image's content box,
    // which is the space shrunkViewport() and the svg viewBox both work in.
    // Normalise the pointer into that space rather than assuming it matches the
    // on-screen rectangle.
    // Clamped: the drag is tracked on the window, so the pointer can be well
    // outside the thumbnail and should pin to its edge rather than extrapolate.
    const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
    const thumbX = clamp(((event.clientX - rect.left) / rect.width) * thumbWidth, thumbWidth);
    const thumbY = clamp(((event.clientY - rect.top) / rect.height) * thumbHeight, thumbHeight);

    const scale = Math.min(thumbWidth / bbox.w, thumbHeight / bbox.h);
    const offsetX = (thumbWidth - bbox.w * scale) / 2;
    const offsetY = (thumbHeight - bbox.h * scale) / 2;

    const graphX = (thumbX - offsetX) / scale + bbox.x1;
    const graphY = (thumbY - offsetY) / scale + bbox.y1;

    const zoom = cy.zoom();
    cy.pan({
      x: this.containerSize().width / 2 - graphX * zoom,
      y: this.containerSize().height / 2 - graphY * zoom
    });
  }
}
