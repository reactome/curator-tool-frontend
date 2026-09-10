/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { NO_ERRORS_SCHEMA } from '@angular/core';

import { commonTestProviders } from 'src/testing';
import { Paper2pathComponent } from './paper2path.component';
import { Paper2pathService } from './services/paper2path.service';

describe('Paper2pathComponent', () => {
  let component: Paper2pathComponent;
  let fixture: ComponentFixture<Paper2pathComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Paper2pathComponent],
      imports: [
        ReactiveFormsModule,
        MatSnackBarModule,
        HttpClientTestingModule,
        BrowserAnimationsModule
      ],
      // The component picked up Store, DataService, PostEditService, InstanceUtilities, and
      // PageTitleService after this spec was first written, which is what had it failing on
      // "No provider for Store". commonTestProviders() covers all of them.
      providers: [...commonTestProviders(), Paper2pathService],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Paper2pathComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize forms correctly', () => {
    expect(component.paperForm).toBeDefined();
    expect(component.configForm).toBeDefined();
    expect(component.pmidsArray).toBeDefined();
  });

  it('should add and remove PMID fields', () => {
    const initialLength = component.pmidsArray.length;
    component.addPmidField('12345678');
    expect(component.pmidsArray.length).toBe(initialLength + 1);
    
    component.removePmidField(0);
    expect(component.pmidsArray.length).toBe(initialLength);
  });

  it('should toggle paper selection', () => {
    const paper = { pmid: '12345678', selected: false };
    component.togglePaperSelection(paper);
    expect(paper.selected).toBe(true);
    
    component.togglePaperSelection(paper);
    expect(paper.selected).toBe(false);
  });

  // The component used to own an extractErrorMessage() helper, which this spec asserted on.
  // Error handling has since moved to reading err.message at the call site and surfacing it
  // through showError(), so these cover the surviving behaviour instead.
  it('surfaces an error in a dismissible snackbar that does not auto-close', () => {
    const open = TestBed.inject(MatSnackBar).open as jasmine.Spy;

    (component as any).showError('Failed to submit annotation: backend down');

    expect(open).toHaveBeenCalled();
    const [message, action, config] = open.calls.mostRecent().args;
    expect(message).toEqual('Failed to submit annotation: backend down');
    expect(action).toEqual('Close');
    expect(config!.panelClass).toEqual(['error-snackbar']);
    // No duration: an error stays until the curator dismisses it.
    expect(config!.duration).toBeUndefined();
  });

  it('auto-dismisses a success message after a few seconds', () => {
    const open = TestBed.inject(MatSnackBar).open as jasmine.Spy;

    (component as any).showSuccess('Annotation complete');

    const config = open.calls.mostRecent().args[2];
    expect(config!.duration).toEqual(5000);
    expect(config!.panelClass).toEqual(['success-snackbar']);
  });

  it('requires a target gene when literature search is enabled', () => {
    const open = TestBed.inject(MatSnackBar).open as jasmine.Spy;
    component.configForm.patchValue({ enableLiteratureSearch: true, targetGene: '' });
    component.addPmidField('12345678');

    component.submitAnnotation();

    expect(open).toHaveBeenCalled();
    expect(open.calls.mostRecent().args[0])
      .toContain('Target gene is required when literature search is enabled');
  });

  it('should correctly determine submit disabled state', () => {
    // No PMIDs or selected papers
    expect(component.isSubmitDisabled()).toBe(true);
    
    // Add a valid PMID
    component.addPmidField('12345678');
    expect(component.isSubmitDisabled()).toBe(false);
    
    // Set processing state
    (component as any).isProcessing = true;
    expect(component.isSubmitDisabled()).toBe(true);
  });
});