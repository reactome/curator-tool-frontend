import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-text-editor-dialog',
  templateUrl: './text-editor-dialog.component.html',
  styleUrls: ['./text-editor-dialog.component.scss']
})
export class TextEditorDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<TextEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { text: string }
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close(this.data.text);
  }
}
