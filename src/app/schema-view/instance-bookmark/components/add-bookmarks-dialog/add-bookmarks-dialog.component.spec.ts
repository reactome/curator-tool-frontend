import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { AddBookmarksDialogComponent, AddBookmarksDialogResult } from './add-bookmarks-dialog.component';

describe('AddBookmarksDialogComponent', () => {
  let component: AddBookmarksDialogComponent;
  let fixture: ComponentFixture<AddBookmarksDialogComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<AddBookmarksDialogComponent, AddBookmarksDialogResult | null>>;

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj<MatDialogRef<AddBookmarksDialogComponent, AddBookmarksDialogResult | null>>(
      'MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [AddBookmarksDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddBookmarksDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('closes with the pasted text', () => {
    component.pastedText = '111, 222\n333';

    component.addPasted();

    expect(dialogRef.close).toHaveBeenCalledWith({ pastedText: '111, 222\n333' });
  });

  it('does not close on an empty paste, whose only content is whitespace', () => {
    component.pastedText = '   \n ';

    component.addPasted();

    expect(component.pastedTextIsEmpty).toBeTrue();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('opens the file chooser rather than closing when the file button is clicked', () => {
    const clicked = spyOn(component.fileInput!.nativeElement, 'click');

    component.chooseFile();

    expect(clicked).toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes with the chosen file and clears the input', () => {
    const file = new File(['111'], 'dbIds.tsv', { type: 'text/tab-separated-values' });
    const input = { files: [file], value: 'dbIds.tsv' };

    component.onFileSelected({ target: input } as unknown as Event);

    expect(dialogRef.close).toHaveBeenCalledWith({ file });
    // Cleared so choosing the same file again still fires a change event.
    expect(input.value).toBe('');
  });

  it('stays open when the file chooser is dismissed without a file', () => {
    component.onFileSelected({ target: { files: [], value: '' } } as unknown as Event);

    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
