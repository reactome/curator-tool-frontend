import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';

/**
 * Centralizes browser tab title updates so every route that pushes a new history entry gets a
 * title distinct from the static "Reactome WebBench" in index.html - without this, every tab
 * looks identical in the browser's tab bar and history, and pages showing different content
 * (an instance, a pathway diagram, a schema class list, ...) can't be told apart.
 *
 * Callers pass the fully-formed, page-specific label (e.g. "Complex: NOD1:iE-DAP [168643]",
 * "Referrers of [Protein:1234] NOD1"); this service only owns the common "- WebBench" suffix and
 * the fallback used when there's no label yet (e.g. before async data has loaded).
 */
@Injectable({
  providedIn: 'root'
})
export class PageTitleService {

  constructor(private titleService: Title) {
  }

  setTitle(label: string | undefined | null): void {
    this.titleService.setTitle(label ? `${label} - WebBench` : 'Reactome WebBench');
  }
}
