import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
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
  // Controls the auto-hiding visibility of the floating fab (independent of isOpen).
  isButtonVisible = true;
  context: HelpContext;

  private sub?: Subscription;
  private hideTimeoutId?: ReturnType<typeof setTimeout>;
  // How close (in px) to the bottom-right corner the mouse must be to reveal the button again.
  private static readonly HOT_ZONE_PX = 120;
  private static readonly AUTO_HIDE_DELAY_MS = 5000;

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
    this.scheduleAutoHide();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.clearAutoHide();
  }

  // Reveal the button whenever the mouse nears the bottom-right corner, and keep it
  // visible for as long as the mouse lingers there.
  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (this.isOpen) return;
    const nearCorner = window.innerWidth - event.clientX <= HelpPanelComponent.HOT_ZONE_PX
      && window.innerHeight - event.clientY <= HelpPanelComponent.HOT_ZONE_PX;
    if (nearCorner) {
      this.isButtonVisible = true;
      this.scheduleAutoHide();
    }
  }

  private scheduleAutoHide(): void {
    this.clearAutoHide();
    this.hideTimeoutId = setTimeout(() => {
      if (!this.isOpen)
        this.isButtonVisible = false;
    }, HelpPanelComponent.AUTO_HIDE_DELAY_MS);
  }

  private clearAutoHide(): void {
    if (this.hideTimeoutId) {
      clearTimeout(this.hideTimeoutId);
      this.hideTimeoutId = undefined;
    }
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
    if (this.isOpen) {
      this.isButtonVisible = true;
      this.clearAutoHide();
    } else {
      this.scheduleAutoHide();
    }
  }

  close(): void {
    this.isOpen = false;
    this.scheduleAutoHide();
  }
}
