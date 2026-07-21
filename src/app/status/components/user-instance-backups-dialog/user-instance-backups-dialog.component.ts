import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialog,
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { take } from 'rxjs';
import { DataService } from 'src/app/core/services/data.service';
import { UserInstancesService } from 'src/app/auth/login/user-instances.service';
import { UserInstanceBackupSummary } from 'src/app/core/models/reactome-instance.model';
import { UnsavedUploadDialogComponent } from 'src/app/shared/components/unsaved-upload-dialog/unsaved-upload-dialog.component';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';

/**
 * Lists the current user's staged-instances backups (auto-created server-side whenever their
 * staged changes get overwritten) and lets them load one back into the current editing session.
 * Restoring only replaces the in-browser ngrx store - it does not save anything by itself, so
 * the state that was current before the restore is left exactly as it was on the server.
 */
@Component({
  selector: 'app-user-instance-backups-dialog',
  templateUrl: './user-instance-backups-dialog.component.html',
  styleUrl: './user-instance-backups-dialog.component.scss',
  standalone: true,
  imports: [CommonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatButtonModule,
    MatTableModule, MatProgressSpinnerModule]
})
export class UserInstanceBackupsDialogComponent implements OnInit {
  backups: UserInstanceBackupSummary[] = [];
  loading: boolean = true;
  restoringFileName: string | null = null;
  readonly displayedColumns = ['timestamp', 'restore'];

  constructor(
    private dataService: DataService,
    private userInstancesService: UserInstancesService,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<UserInstanceBackupsDialogComponent>
  ) {
  }

  ngOnInit(): void {
    this.dataService.listUserInstanceBackups().subscribe({
      next: (backups: UserInstanceBackupSummary[]) => {
        this.backups = backups || [];
        this.loading = false;
      },
      error: () => {
        this.backups = [];
        this.loading = false;
      }
    });
  }

  restore(backup: UserInstanceBackupSummary): void {
    const confirmRef = this.dialog.open(UnsavedUploadDialogComponent, {
      data: {
        title: 'Restore Backup',
        message: `Load the backup from ${this.formatTimestamp(backup.lastModified)} into your current editing session? `
          + `This replaces your currently staged (unsaved) changes in the editor - it does not save anything by itself. `
          + `Your last saved changes remain safely on the server either way.`
      }
    });
    confirmRef.afterClosed().pipe(take(1)).subscribe((confirmed: boolean | null) => {
      if (confirmed !== true)
        return;
      this.restoringFileName = backup.fileName;
      this.userInstancesService.restoreUserInstanceBackup(backup.fileName).subscribe({
        next: () => {
          this.restoringFileName = null;
          this.dialogRef.close();
          this.dialog.open(InfoDialogComponent, {
            data: {
              title: 'Backup Loaded',
              message: 'The backup has been loaded into your editing session. Review the changes and click Save to keep them.'
            }
          });
        },
        error: () => {
          this.restoringFileName = null;
        }
      });
    });
  }

  formatTimestamp(epochMillis: number): string {
    return new Date(epochMillis).toLocaleString();
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
