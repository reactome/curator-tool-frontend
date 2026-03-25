import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface CommitWaitDialogData {
  title?: string;
  message?: string;
}

@Component({
  selector: 'app-commit-wait-dialog',
  templateUrl: './commit-wait-dialog.component.html',
  styleUrl: './commit-wait-dialog.component.scss',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommitWaitDialogComponent {
  private readonly dialogData = inject<CommitWaitDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly title = this.dialogData?.title ?? 'Committing Changes';
  readonly message = this.dialogData?.message ?? 'Please wait while the server processes your request...';
}