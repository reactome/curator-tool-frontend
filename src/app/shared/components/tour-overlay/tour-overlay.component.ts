import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { TourService, TourState, TourStep } from '../../../core/services/tour.service';

@Component({
  selector: 'app-tour-overlay',
  templateUrl: './tour-overlay.component.html',
  styleUrls: ['./tour-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TourOverlayComponent implements OnInit, OnDestroy {
  state: TourState = { active: false, steps: [], currentIndex: 0 };
  highlightRect: DOMRect | null = null;

  private sub!: Subscription;

  constructor(
    private tourService: TourService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.tourService.state$.subscribe((s) => {
      this.state = s;
      this.updateHighlight();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get currentStep(): TourStep | null {
    return this.state.active && this.state.steps.length > 0
      ? this.state.steps[this.state.currentIndex]
      : null;
  }

  get isFirst(): boolean {
    return this.state.currentIndex === 0;
  }

  get isLast(): boolean {
    return this.state.currentIndex === this.state.steps.length - 1;
  }

  get progressPercent(): number {
    if (!this.state.steps.length) return 0;
    return ((this.state.currentIndex + 1) / this.state.steps.length) * 100;
  }

  next(): void {
    this.tourService.next();
  }

  prev(): void {
    this.tourService.prev();
  }

  end(): void {
    this.tourService.end();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.state.active) return;
    if (event.key === 'ArrowRight') this.next();
    else if (event.key === 'ArrowLeft') this.prev();
    else if (event.key === 'Escape') this.end();
  }

  private updateHighlight(): void {
    const step = this.currentStep;
    if (!step?.targetSelector) {
      this.highlightRect = null;
      return;
    }
    // Allow a tick for any route change to render
    setTimeout(() => {
      const el = document.querySelector(step.targetSelector!) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        this.highlightRect = el.getBoundingClientRect();
      } else {
        this.highlightRect = null;
      }
      this.cdr.markForCheck();
    }, 120);
  }
}
