import { Component, OnInit, inject } from '@angular/core';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import { NLQueryPanelComponent } from './nl-query-panel.component';

/** Full-page host for the natural-language graph query panel (route: /graph_query). */
@Component({
  selector: 'app-nl-query-page',
  standalone: true,
  imports: [NLQueryPanelComponent],
  template: `
    <div class="nlq-page">
      <header class="nlq-header">
        <h2>Ask the Curation Graph</h2>
        <p>Ask in plain English; follow-up questions keep the context. Results with dbIds are listed as instances; click one to open it.</p>
      </header>
      <app-nl-query-panel (dbIdSelected)="openInstance($event)"></app-nl-query-panel>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .nlq-page { display: flex; flex-direction: column; height: 100vh; box-sizing: border-box;
                max-width: 960px; margin: 0 auto; padding: 16px 24px 0; }
    .nlq-header { padding-bottom: 12px; border-bottom: 1px solid var(--outline-variant); }
    .nlq-header h2 { margin: 0; }
    .nlq-header p { margin: 4px 0 0; font-size: 13px; color: var(--on-surface-variant); }
    app-nl-query-panel { flex: 1; min-height: 0; }
  `],
})
export class NLQueryPageComponent implements OnInit {
  private pageTitle = inject(PageTitleService);

  ngOnInit(): void {
    this.pageTitle.setTitle('Ask the Graph');
  }

  /** Open in a new tab so the conversation on this page is kept. */
  openInstance(dbId: number): void {
    window.open(`schema_view/instance/${dbId}`, '_blank');
  }
}
