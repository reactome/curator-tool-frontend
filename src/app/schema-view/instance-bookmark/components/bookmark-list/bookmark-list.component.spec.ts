import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of, Subject } from 'rxjs';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { BookmarkUploadService } from '../../bookmark-upload.service';
import { AddBookmarksDialogComponent, AddBookmarksDialogResult } from '../add-bookmarks-dialog/add-bookmarks-dialog.component';
import { BookmarkListComponent } from './bookmark-list.component';

describe('BookmarkListComponent', () => {
  let component: BookmarkListComponent;
  let fixture: ComponentFixture<BookmarkListComponent>;
  let bookmarkUploadService: jasmine.SpyObj<BookmarkUploadService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let dialogResult: AddBookmarksDialogResult | null;

  /** What the add-bookmarks dialog closed with, as the component sees it. */
  function closeDialogWith(result: AddBookmarksDialogResult | null): void {
    dialogResult = result;
    fixture.nativeElement.querySelector('.upload_button').click();
  }

  beforeEach(async () => {
    const instUtils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities',
      ['makeShell', 'isPermanentlyRemovedNewInstance']);
    instUtils.isPermanentlyRemovedNewInstance.and.returnValue(false);
    // The component subscribes to these in its constructor / ngOnInit.
    (instUtils as any).committedNewInstDbId$ = new Subject<[number, number]>();
    (instUtils as any).refreshViewDbId$ = new Subject<number>();

    const store = jasmine.createSpyObj<Store>('Store', ['dispatch', 'select']);
    store.select.and.returnValue(of([]) as any);

    bookmarkUploadService = jasmine.createSpyObj<BookmarkUploadService>('BookmarkUploadService',
      ['uploadFile', 'uploadPastedText']);

    dialogResult = null;
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialog.open.and.callFake(() => ({ afterClosed: () => of(dialogResult) }) as any);

    await TestBed.configureTestingModule({
      declarations: [BookmarkListComponent],
      schemas: [NO_ERRORS_SCHEMA], // The Material / CDK directives in the template are not what is under test
      providers: [
        { provide: Store, useValue: store },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        { provide: ActivatedRoute, useValue: { pathFromRoot: [] } },
        { provide: InstanceUtilities, useValue: instUtils },
        { provide: DataService, useValue: jasmine.createSpyObj<DataService>('DataService', ['fetchInstance']) },
        { provide: BookmarkUploadService, useValue: bookmarkUploadService },
        { provide: MatDialog, useValue: dialog },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookmarkListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('asks how to add the bookmarks when the toolbar button is clicked', () => {
    fixture.nativeElement.querySelector('.upload_button').click();

    expect(dialog.open).toHaveBeenCalledWith(AddBookmarksDialogComponent);
  });

  it('hands a file chosen in the dialog to the upload service', () => {
    const file = new File(['111'], 'dbIds.csv', { type: 'text/csv' });

    closeDialogWith({ file });

    expect(bookmarkUploadService.uploadFile).toHaveBeenCalledWith(file);
    expect(bookmarkUploadService.uploadPastedText).not.toHaveBeenCalled();
  });

  it('hands dbIds pasted into the dialog to the upload service', () => {
    closeDialogWith({ pastedText: '111, 222' });

    expect(bookmarkUploadService.uploadPastedText).toHaveBeenCalledWith('111, 222');
    expect(bookmarkUploadService.uploadFile).not.toHaveBeenCalled();
  });

  it('does nothing when the dialog is cancelled', () => {
    closeDialogWith(null);

    expect(bookmarkUploadService.uploadFile).not.toHaveBeenCalled();
    expect(bookmarkUploadService.uploadPastedText).not.toHaveBeenCalled();
  });
});
