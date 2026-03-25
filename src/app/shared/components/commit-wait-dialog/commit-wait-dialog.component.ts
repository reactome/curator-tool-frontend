import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-commit-wait-dialog',
  templateUrl: './commit-wait-dialog.component.html',
  styleUrl: './commit-wait-dialog.component.scss',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommitWaitDialogComponent {}