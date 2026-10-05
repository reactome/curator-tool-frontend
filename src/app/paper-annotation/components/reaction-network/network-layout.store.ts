import { Injectable } from '@angular/core';

export interface SavedLayout {
  positions: Record<string, { x: number; y: number }>;
  zoom: number;
  pan: { x: number; y: number };
}

/**
 * Remembers how a curator arranged each session's network (node positions, zoom and pan), so leaving the tab
 * and coming back, or reloading after an edit, does not throw the arrangement away. Kept for the page's lifetime.
 */
@Injectable({ providedIn: 'root' })
export class NetworkLayoutStore {
  private layouts = new Map<string, SavedLayout>();

  get(sessionId: string): SavedLayout | undefined {
    return this.layouts.get(sessionId);
  }

  save(sessionId: string, layout: SavedLayout): void {
    this.layouts.set(sessionId, layout);
  }

  forget(sessionId: string): void {
    this.layouts.delete(sessionId);
  }
}
