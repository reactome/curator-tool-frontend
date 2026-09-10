import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { componentTestImports, provideDialogContext } from 'src/testing';
import { TextEditorDialogComponent } from './text-editor-dialog.component';

describe('TextEditorDialogComponent', () => {
  let component: TextEditorDialogComponent;
  let dialogRef: MatDialogRef<TextEditorDialogComponent>;
  let data: { text: string };
  /** The two elements highlightMatches() reads out of the document to sync scrolling. */
  let scaffold: HTMLElement[];

  function build(text: string) {
    data = { text };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        TextEditorDialogComponent,
        ...provideDialogContext(data),
        { provide: MAT_DIALOG_DATA, useValue: data }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    component = TestBed.inject(TextEditorDialogComponent);
    dialogRef = TestBed.inject(MatDialogRef);
  }

  beforeEach(() => {
    // highlightMatches() reaches into the live document for #editor and #highlighting and
    // dereferences both without a null check, so they have to exist for these tests.
    scaffold = ['editor', 'highlighting'].map(id => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
      return el;
    });
  });

  afterEach(() => {
    scaffold.forEach(el => el.remove());
    document.querySelectorAll('mark.highlight').forEach(el => el.remove());
  });

  it('seeds the highlighted text from the text it was opened with', () => {
    build('Glucose is phosphorylated.');

    expect(component.highlightedText).toEqual('Glucose is phosphorylated.');
  });

  it('closes with the edited text when confirmed', () => {
    build('original');
    component.data.text = 'edited';

    component.onOkay();

    expect(dialogRef.close).toHaveBeenCalledWith('edited');
  });

  it('closes with nothing when cancelled, discarding the edit', () => {
    build('original');
    component.data.text = 'edited';

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  it('strips highlight markup before closing, so the markup is never saved', () => {
    build('Glucose and glucose');
    component.data.text = 'A <mark id="match-0" class="highlight">glucose</mark> molecule';

    component.onOkay();

    expect(dialogRef.close).toHaveBeenCalledWith('A glucose molecule');
  });

  it('escapes regex metacharacters so a literal search is literal', () => {
    build('');

    expect(component.escapeRegExp('a+b')).toEqual('a\\+b');
    expect(component.escapeRegExp('(x)')).toEqual('\\(x\\)');
    expect(component.escapeRegExp('a.b*c?')).toEqual('a\\.b\\*c\\?');
  });

  it('replaces every occurrence with replaceAll', fakeAsync(() => {
    build('ATP + ATP + ADP');
    component.findText = 'ATP';
    component.replaceText = 'GTP';

    component.replaceAll();
    tick();
    component.removeHighlight();

    expect(component.data.text).toEqual('GTP + GTP + ADP');
  }));

  it('treats the search term literally in replaceAll', fakeAsync(() => {
    // Without escaping, "G6P (open)" would be read as a regex group and match nothing.
    build('G6P (open) ring');
    component.findText = 'G6P (open)';
    component.replaceText = 'G6P';

    component.replaceAll();
    tick();
    component.removeHighlight();

    expect(component.data.text).toEqual('G6P ring');
  }));

  it('does nothing when replaceAll is invoked with no search term', () => {
    build('ATP + ADP');
    component.replaceText = 'GTP';

    component.replaceAll();

    expect(component.data.text).toEqual('ATP + ADP');
  });

  it('counts the matches found for a search term', fakeAsync(() => {
    build('ATP + ATP + ADP');
    component.findText = 'ATP';

    component.highlightMatches();
    tick();

    expect(component.matchCount).toEqual(2);
  }));

  it('matches case-insensitively when counting', fakeAsync(() => {
    build('atp + ATP');
    component.findText = 'ATP';

    component.highlightMatches();
    tick();

    expect(component.matchCount).toEqual(2);
  }));

  it('resets to the original text and a zero count when the term is cleared', fakeAsync(() => {
    build('ATP + ADP');
    component.findText = 'ATP';
    component.highlightMatches();
    tick();

    component.findText = '';
    component.highlightMatches();

    expect(component.matchCount).toEqual(0);
    expect(component.highlightedText).toEqual(component.data.text);
  }));

  it('clears the search term and the count together', fakeAsync(() => {
    build('ATP + ATP');
    component.findText = 'ATP';
    component.highlightMatches();
    tick();

    component.clearSearch();

    expect(component.findText).toEqual('');
    expect(component.matchCount).toEqual(0);
    expect(component.data.text).toEqual('ATP + ATP');
  }));

  it('replaces only the current match with replaceCurrent', fakeAsync(() => {
    build('ATP + ATP + ATP');
    component.findText = 'ATP';
    component.replaceText = 'GTP';
    component.highlightMatches();
    tick();
    component.removeHighlight();
    component.currentMatch = 1;

    component.replaceCurrent();
    tick();
    component.removeHighlight();

    expect(component.data.text).toEqual('ATP + GTP + ATP');
  }));

  it('does nothing on replaceCurrent when no match has been found', () => {
    build('ATP');
    component.findText = 'GTP';
    component.matchCount = 0;

    component.replaceCurrent();

    expect(component.data.text).toEqual('ATP');
  });

  it('wraps to the first match when advancing past the last', fakeAsync(() => {
    build('ATP + ATP');
    component.findText = 'ATP';
    component.highlightMatches();
    tick();
    component.currentMatch = 1;

    component.goToNextMatch();
    tick();

    expect(component.currentMatch).toEqual(0);
  }));

  it('wraps to the last match when stepping back from the first', fakeAsync(() => {
    build('ATP + ATP + ATP');
    component.findText = 'ATP';
    component.highlightMatches();
    tick();
    component.currentMatch = 0;

    component.goToPreviousMatch();
    tick();

    expect(component.currentMatch).toEqual(2);
  }));

  it('clamps an out-of-range jump back into the match list', fakeAsync(() => {
    build('ATP + ATP');
    component.findText = 'ATP';
    component.highlightMatches();
    tick();

    component.goToMatch(-1);
    tick();
    expect(component.currentMatch).toEqual(1);

    component.goToMatch(99);
    tick();
    expect(component.currentMatch).toEqual(0);
  }));

  it('ignores navigation when there are no matches', () => {
    build('ATP');
    component.matchCount = 0;
    component.currentMatch = 0;

    component.goToNextMatch();
    component.goToPreviousMatch();
    component.goToMatch(3);

    expect(component.currentMatch).toEqual(0);
  });

  it('toggles the find-and-replace panel', () => {
    build('');

    expect(component.findAndReplaceContainer).toBeFalse();
    component.showFindAndReplace();
    expect(component.findAndReplaceContainer).toBeTrue();
    component.showFindAndReplace();
    expect(component.findAndReplaceContainer).toBeFalse();
  });

  it('takes the editor content on change', fakeAsync(() => {
    build('old');

    component.onEditorChange({ html: '<p>new</p>' });
    tick();

    expect(component.data.text).toContain('new');
  }));

  it('removes both span and mark highlight wrappers', () => {
    build('');
    component.data.text =
      '<span class="highlight">a</span> and <mark id="match-1" class="highlight">b</mark>';

    component.removeHighlight();

    expect(component.data.text).toEqual('a and b');
  });

  it('is a no-op to remove highlights from unhighlighted text', () => {
    build('plain text');

    component.removeHighlight();

    expect(component.data.text).toEqual('plain text');
  });
});
