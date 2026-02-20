import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle
} from '@angular/material/dialog';

@Component({
  selector: 'app-unsaved-upload-dialog',
  templateUrl: './unsaved-upload-dialog.component.html',
  styleUrl: './unsaved-upload-dialog.component.scss',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnsavedUploadDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}
