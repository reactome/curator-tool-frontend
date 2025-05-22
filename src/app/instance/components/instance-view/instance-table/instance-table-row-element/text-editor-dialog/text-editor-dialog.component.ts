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
  findAndReplaceContainer: boolean = false; // Flag to show/hide the find and replace container
  
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
    this.highlightMatches(); // Highlight the matches after replacement
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
    let textArea = document.getElementById('editor'); // Reference to the text area element
    let pre = document.getElementById('highlighting'); // Reference to the pre element

    this.syncScroll(textArea!, pre!); // Sync scroll positions
  }

  private escapeRegExp(text: string): string {
    // Escape special characters for use in a regular expression
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }


  syncScroll(editor: HTMLElement, pre: HTMLElement) {
      pre.scrollTop = editor.scrollTop;
      pre.scrollLeft = editor.scrollLeft;
  }

  showFindAndReplace() {
    this.findAndReplaceContainer = !this.findAndReplaceContainer; // Toggle the visibility of the find and replace container
    }
}
