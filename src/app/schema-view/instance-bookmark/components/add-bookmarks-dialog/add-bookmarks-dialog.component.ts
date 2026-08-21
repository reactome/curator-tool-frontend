import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';

/**
 * Which of the dialog's two ways of naming instances the curator used. Only one of the fields is
 * ever set: the dialog closes as soon as either is acted on.
 */
export interface AddBookmarksDialogResult {
  pastedText?: string;
  file?: File;
}

/**
 * Asks for the instances to bookmark in bulk, either as dbIds pasted straight into the dialog or
 * as a CSV/TSV file whose first column holds them. Both are offered together because the two
 * cases are equally common - a handful of dbIds out of an email or a chat message, and the file
 * downloaded from an instance list - and pasting should not require making a file first.
 *
 * The dialog itself only collects the input; parsing it and bookmarking what it names is
 * BookmarkUploadService's job.
 */
@Component({
  selector: 'app-add-bookmarks-dialog',
  templateUrl: './add-bookmarks-dialog.component.html',
  styleUrls: ['./add-bookmarks-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogTitle, MatDialogContent, MatDialogActions,
    MatDialogClose, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
})
export class AddBookmarksDialogComponent {
  pastedText = '';

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  constructor(private dialogRef: MatDialogRef<AddBookmarksDialogComponent, AddBookmarksDialogResult | null>) {
  }

  /** True while there is nothing pasted worth reading, so the paste button stays disabled. */
  get pastedTextIsEmpty(): boolean {
    return this.pastedText.trim().length === 0;
  }

  addPasted(): void {
    if (this.pastedTextIsEmpty)
      return;
    this.dialogRef.close({ pastedText: this.pastedText });
  }

  chooseFile(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // Allow re-selecting the same file to fire another change event.
    if (!file)
      return; // The curator cancelled the file chooser; the dialog stays open.
    this.dialogRef.close({ file });
  }
}
