import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogClose
} from '@angular/material/dialog';

export interface FileNamePromptDialogData {
  title: string;
  message?: string;
  defaultFileName: string;
}

@Component({
  selector: 'app-file-name-prompt-dialog',
  templateUrl: './file-name-prompt-dialog.component.html',
  styleUrl: './file-name-prompt-dialog.component.scss',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class FileNamePromptDialogComponent {
  fileName: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: FileNamePromptDialogData,
    private dialogRef: MatDialogRef<FileNamePromptDialogComponent>
  ) {
    this.fileName = data.defaultFileName;
  }

  submit(): void {
    const trimmed = this.fileName?.trim();
    if (!trimmed)
      return;
    this.dialogRef.close(trimmed);
  }
}
