import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
  selector: 'app-text-editor-dialog',
  templateUrl: './text-editor-dialog.component.html',
  styleUrls: ['./text-editor-dialog.component.scss']
})
export class TextEditorDialogComponent {

  findText: string = ''; // Text to find
  replaceText: string = ''; // Text to replace with
  highlightedText: string = ''; // Text with highlights
  removeFindText: string = ''; // Keep the last search text that was entered
  findAndReplaceContainer: boolean = false; // Flag to show/hide the find and replace container
  matchCount: number = 0; // Count of matches found
  currentMatch: number = 0; // Index of the current match being viewed

  constructor(
    public dialogRef: MatDialogRef<TextEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { text: string }
  ) {
    this.highlightedText = this.data.text; // Initialize highlighted text with the original text
  }

  onCancel(): void {
    this.removeHighlight();
    this.dialogRef.close();
  }

  onOkay(): void {
    this.removeHighlight();
    this.dialogRef.close(this.data.text);
  }

  // findAndReplace(): void {
  //   if (!this.findText) {
  //     return; // Do nothing if the find text is empty
  //   }

  //   const regex = new RegExp(this.findText, 'g'); // Create a global regex for the find text
  //   this.data.text = this.data.text.replace(regex, this.replaceText); // Replace all occurrences
  //   this.highlightMatches(); // Highlight the matches after replacement
  // }

  replaceAll(): void {
    if (!this.findText) return;
    const regex = new RegExp(this.escapeRegExp(this.findText), 'g');
    this.data.text = this.data.text.replace(regex, this.replaceText);
    this.highlightMatches();
  }

replaceCurrent(): void {
  if (!this.findText || this.matchCount === 0) return;

  const regex = new RegExp(this.escapeRegExp(this.findText), 'gi');
  let matchIndex = 0;
  let replaced = false;

  // Replace only the match at currentMatch
  this.data.text = this.data.text.replace(regex, (match) => {
    if (matchIndex === this.currentMatch && !replaced) {
      replaced = true;
      matchIndex++;
      return this.replaceText;
    }
    matchIndex++;
    return match;
  });

  this.highlightMatches();
}

  // Utility to escape special regex characters
  escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  highlightMatches(): void {
    if (!this.findText) {
      this.highlightedText = this.data.text; // Reset to original text if no search term
      this.matchCount = 0;
      return;
    }

    this.removeHighlight();

    const regex = new RegExp(`(${this.escapeRegExp(this.findText)})`, 'gi'); // Create a regex to match the search term
    let matchIndex = 0;
    this.data.text = this.data.text.replace(
      regex,
      (match) => {
        const id = `match-${matchIndex}`;
        matchIndex++;
        return `<a id="${id}" class="highlight" href="#">${match}</a>`;
      }
    );
    this.matchCount = matchIndex;
    this.currentMatch = 0;

    setTimeout(() => {
      const firstMatch = document.getElementById('match-0'); // Get the first match element
      if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (firstMatch as HTMLElement).focus();
      }
    }, 0);
    let textArea = document.getElementById('editor'); // Reference to the text area element
    let pre = document.getElementById('highlighting'); // Reference to the pre element

    this.syncScroll(textArea!, pre!); // Sync scroll positions
  }

  removeHighlight(): void {
    // Remove all highlights from the text
    this.data.text = this.data.text
      .replace(/<span class="highlight">/g, '')
      .replace(/<a[^>]*class="highlight"[^>]*>/g, '')
      // Remove corresponding closing tags
      .replace(/<\/span>/g, '')
      .replace(/<\/a>/g, '');
  }


  syncScroll(editor: HTMLElement, pre: HTMLElement) {
    pre.scrollTop = editor.scrollTop;
    pre.scrollLeft = editor.scrollLeft;

  }

  showFindAndReplace() {
    this.findAndReplaceContainer = !this.findAndReplaceContainer; // Toggle the visibility of the find and replace container
  }

  onEditorChange($event: any) {
    this.data.text = $event.html; // Update the data text with the editor's HTML content
    this.highlightMatches(); // Highlight matches after any change}
  }

  config: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: '15rem',
    minHeight: '5rem',
    placeholder: 'Enter text here...',
    translate: 'no',
    defaultParagraphSeparator: 'p',
    defaultFontName: 'Arial',
    toolbarHiddenButtons: [
      ['bold']
    ],
    customClasses: [
      {
        name: "quote",
        class: "quote",
      },
      {
        name: 'redText',
        class: 'redText'
      },
      {
        name: "titleText",
        class: "titleText",
        tag: "h1",
      },
    ]
  };
  clearSearch(): void {
    this.findText = '';
    this.removeHighlight();
    this.highlightedText = this.data.text; // Or set to the original text
    this.matchCount = 0;
  }
  goToMatch(index: number) {
    if (this.matchCount === 0) return;
    // Clamp index to valid range
    if (index < 0) index = this.matchCount - 1;
    if (index >= this.matchCount) index = 0;
    this.currentMatch = index;
    setTimeout(() => {
      const el = document.getElementById(`match-${index}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).focus();
      }
    }, 0);
  }

  goToNextMatch() {
    if (this.matchCount === 0) return;
    this.goToMatch((this.currentMatch + 1) % this.matchCount);
  }

  goToPreviousMatch() {
    if (this.matchCount === 0) return;
    this.goToMatch((this.currentMatch - 1 + this.matchCount) % this.matchCount);
  }
}
