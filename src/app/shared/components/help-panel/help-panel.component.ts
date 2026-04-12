import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HelpContext, HelpContextService } from '../../../core/services/help-context.service';

@Component({
  selector: 'app-help-panel',
  templateUrl: './help-panel.component.html',
  styleUrls: ['./help-panel.component.scss'],
})
export class HelpPanelComponent implements OnInit, OnDestroy {
  /** Optional: override auto-detection by passing explicit view key. */
  @Input() view?: string;

  isOpen = false;
  context: HelpContext;

  private sub?: Subscription;

  constructor(
    private helpContextService: HelpContextService,
    private router: Router,
  ) {
    this.context = this.helpContextService.getContext('home');
  }

  ngOnInit(): void {
    if (this.view) {
      this.applyView(this.view);
    } else {
      // Auto-detect from URL
      this.applyView(this.urlToView(this.router.url));
      this.sub = this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe((e) => {
          this.applyView(this.urlToView((e as NavigationEnd).urlAfterRedirects));
        });
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private applyView(v: string): void {
    this.context = this.helpContextService.getContext(v);
    this.helpContextService.setContext(v);
  }

  private urlToView(url: string): string {
    if (url.includes('schema_view')) return 'schema-view';
    if (url.includes('event_view')) return 'event-view';
    if (url.includes('gene2path')) return 'gene2path';
    if (url.includes('paper2path')) return 'paper2path';
    if (url.includes('tutorial')) return 'tutorial';
    return 'home';
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  close(): void {
    this.isOpen = false;
  }
}
