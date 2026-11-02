import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { PaperAnnotationModule } from '../../paper-annotation.module';
import { LoadStagingDialogComponent, LoadStagingDialogData } from './load-staging-dialog.component';

describe('LoadStagingDialogComponent', () => {
  const text = (data: Partial<LoadStagingDialogData>): string => {
    TestBed.configureTestingModule({
      imports: [PaperAnnotationModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: { staged: 0, keepsDefaultPerson: false, keepsBookmarks: 0, incoming: 12, stale: false, ...data } }]
    });
    const f = TestBed.createComponent(LoadStagingDialogComponent);
    f.detectChanges();
    return (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  };

  it('says what is replaced and that it is backed up first', () => {
    const t = text({ staged: 7 });
    expect(t).toContain('12 new instances');
    expect(t).toContain('replaces the 7 items');
    expect(t).toContain('saved to a backup first');
    expect(t).not.toContain('default person');
  });

  it('says how many of the reactions were checked, and that the rest and the pathway stay out', () => {
    const t = text({ staged: 7, reactions: 3, totalReactions: 11 });
    expect(t).toContain('3 of 11 reactions you checked');
    expect(t).toContain('12 new instances');
    expect(t).toContain('Reactions you did not check, and the annotation\'s pathway, are not loaded');
  });

  it('says the pathway comes too when every reaction is checked', () => {
    const t = text({ staged: 7, reactions: 11, totalReactions: 11, pathway: true });
    expect(t).toContain('all 11 reactions and the annotation\'s pathway');
    expect(t).not.toContain('not loaded');
  });

  const none = { filled: [], unfilled: [], pdfs: [] };

  it('counts the references filled in from PubMed', () => {
    expect(text({ references: { ...none, filled: ['1', '3'] } })).toContain('2 new literature references were filled in from PubMed.');
  });

  it('says which references could not be filled in', () => {
    expect(text({ references: { ...none, unfilled: ['7'] } })).toContain('PMID 7 could not be filled in from PubMed, so it is loaded with the PubMed ID only');
  });

  it('says which PDFs have no PubMed ID', () => {
    expect(text({ references: { ...none, pdfs: ['notes.pdf'] } })).toContain('notes.pdf has no PubMed ID. A reference named after the file is created');
  });

  it('says nothing about cited papers when there is nothing to say', () => {
    expect(text({ references: none })).not.toContain('PubMed');
  });

  it('says the default person is kept', () => {
    const t = text({ staged: 7, keepsDefaultPerson: true });
    expect(t).toContain('Kept as they are: your default person.');
    expect(t).toContain('replaces the 7 items');
  });

  it('says the bookmarks are kept, with their number', () => {
    expect(text({ staged: 7, keepsBookmarks: 3 })).toContain('Kept as they are: your 3 bookmarks.');
  });

  it('says a single bookmark is kept', () => {
    expect(text({ staged: 7, keepsBookmarks: 1 })).toContain('Kept as they are: your 1 bookmark.');
  });

  it('says both are kept together', () => {
    expect(text({ staged: 7, keepsDefaultPerson: true, keepsBookmarks: 2 })).toContain('Kept as they are: your default person and 2 bookmarks.');
  });

  it('with only kept things staged, says nothing else is replaced', () => {
    const t = text({ staged: 0, keepsDefaultPerson: true, keepsBookmarks: 2 });
    expect(t).toContain('nothing staged at the moment apart from your default person and 2 bookmarks, so nothing is replaced');
    expect(t).toContain('Kept as they are: your default person and 2 bookmarks.');
  });

  it('with nothing staged at all, says so plainly', () => {
    const t = text({ staged: 0 });
    expect(t).toContain('nothing staged at the moment, so nothing is replaced');
    expect(t).not.toContain('Kept as they are');
  });

  it('warns about edits made in the chat and about the staging limit', () => {
    const t = text({ staged: 1, stale: true, incoming: 250 });
    expect(t).toContain('Edits you accepted in the chat are included');
    expect(t).toContain('more than the 200 staged instances');
  });
});
