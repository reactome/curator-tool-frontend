import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';

export interface InactivityWarningData {
  /** How many seconds to count down before logging the user out. */
  countdownSeconds: number;
}

/** Result returned via MatDialogRef.afterClosed(). */
export type InactivityWarningResult = 'stay' | 'logout';

/**
 * Warns the user that they are about to be logged out for inactivity and gives
 * them a chance to stay signed in. Closes with `'stay'` if they act in time, or
 * `'logout'` if the countdown expires or they choose to log out now.
 */
@Component({
  selector: 'app-inactivity-warning-dialog',
  templateUrl: 'inactivity-warning-dialog.component.html',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InactivityWarningDialogComponent implements OnInit, OnDestroy {
  remainingSeconds: number;
  private intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: InactivityWarningData,
    private dialogRef: MatDialogRef<InactivityWarningDialogComponent, InactivityWarningResult>,
    private cdr: ChangeDetectorRef
  ) {
    this.remainingSeconds = Math.max(0, Math.floor(data.countdownSeconds));
  }

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.remainingSeconds -= 1;
      if (this.remainingSeconds <= 0) {
        this.dialogRef.close('logout');
        return;
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== undefined)
      clearInterval(this.intervalId);
  }

  stayLoggedIn(): void {
    this.dialogRef.close('stay');
  }

  logoutNow(): void {
    this.dialogRef.close('logout');
  }
}
