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
  highlightedText: string = ''; // Text with highlights
  
  constructor(
    public dialogRef: MatDialogRef<TextEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { text: string }
  ) {
  }

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

  highlightMatches(): void {
    if (!this.findText) {
      this.highlightedText = this.data.text; // Reset to original text if no search term
      return;
    }

    const regex = new RegExp(`(${this.escapeRegExp(this.findText)})`, 'gi'); // Create a regex to match the search term
    this.highlightedText = this.data.text.replace(
      regex,
      '<mark class="highlight">$1</mark>' // Wrap matches in a span with a highlight class
    );
  }

  private escapeRegExp(text: string): string {
    // Escape special characters for use in a regular expression
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // onInput(editor: HTMLTextAreaElement) {
  //   let miql = editor.value;
  //   if (miql.endsWith('\n')) {
  //     miql += ' ';
  //   }
  //   this.highlightedText = this.highlightMatches(miql)
  // }


  syncScroll(editor: HTMLTextAreaElement, pre: HTMLPreElement) {
    setTimeout(() => {
      pre.scrollTop = editor.scrollTop;
      pre.scrollLeft = editor.scrollLeft;
    })
  }
}
