import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-text-editor-dialog',
  templateUrl: './text-editor-dialog.component.html',
  styleUrls: ['./text-editor-dialog.component.scss']
})
export class TextEditorDialogComponent {
  findText: string = ''; // Text to find
  replaceText: string = ''; // Text to replace with
  
  constructor(
    public dialogRef: MatDialogRef<TextEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { text: string }
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onOkay(): void {
    this.dialogRef.close(this.data.text);
  }

  findAndReplace(): void {
    if (!this.findText) {
      return; // Do nothing if the find text is empty
    }

    const regex = new RegExp(this.findText, 'g'); // Create a global regex for the find text
    this.data.text = this.data.text.replace(regex, this.replaceText); // Replace all occurrences
  }
}
