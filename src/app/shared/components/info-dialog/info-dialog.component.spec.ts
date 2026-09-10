import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { componentTestImports } from 'src/testing';
import { InfoDialogComponent } from './info-dialog.component';

describe('InfoDialogComponent', () => {
  let fixture: ComponentFixture<InfoDialogComponent>;

  /** Builds the standalone dialog with the given injected data. */
  function build(data: any) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      // Standalone component, so it goes in imports rather than declarations.
      imports: [...componentTestImports(), InfoDialogComponent],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: data }]
    });
    fixture = TestBed.createComponent(InfoDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('takes its title, message, and instance info from the injected data', () => {
    const component = build({
      title: 'Error',
      message: 'Wrong user name or password',
      instanceInfo: ''
    });

    expect(component.data.title).toEqual('Error');
    expect(component.data.message).toEqual('Wrong user name or password');
  });

  it('renders the title and message', () => {
    build({ title: 'Error', message: 'Wrong user name or password', instanceInfo: '' });

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Error');
    expect(text).toContain('Wrong user name or password');
  });

  it('renders the instance info when one is supplied', () => {
    build({
      title: 'Cannot commit',
      message: 'The instance failed QA.',
      instanceInfo: 'Glycolysis (100)'
    });

    expect(fixture.nativeElement.textContent).toContain('Glycolysis (100)');
  });

  it('renders without an instance info line', () => {
    // Most callers pass an empty string here; the dialog must not require it.
    build({ title: 'Note', message: 'Saved.', instanceInfo: '' });

    expect(fixture.nativeElement.textContent).toContain('Saved.');
  });
});
