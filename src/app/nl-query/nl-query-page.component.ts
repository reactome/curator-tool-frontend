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
      <h2>Ask the Curation Graph</h2>
      <p class="nlq-hint">Read-only. Ask in plain English; follow-up questions keep the context. Click a dbId to open the instance.</p>
      <app-nl-query-panel (dbIdSelected)="openInstance($event)"></app-nl-query-panel>
    </div>
  `,
  styles: [`
    .nlq-page { display: flex; flex-direction: column; height: 100vh; box-sizing: border-box;
                max-width: 1200px; margin: 0 auto; padding: 16px; }
    .nlq-page h2 { margin: 0; }
    .nlq-hint { margin: 4px 0 12px; opacity: .7; font-size: 13px; }
    app-nl-query-panel { display: block; flex: 1; min-height: 0; }
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
