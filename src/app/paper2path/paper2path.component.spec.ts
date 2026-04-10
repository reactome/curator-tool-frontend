/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

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
      providers: [Paper2pathService]
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

  it('should extract meaningful error messages', () => {
    // Test string error
    expect((component as any).extractErrorMessage('Simple error')).toBe('Simple error');
    
    // Test error object with message
    const errorWithMessage = { message: 'Test error message' };
    expect((component as any).extractErrorMessage(errorWithMessage)).toBe('Test error message');
    
    // Test HTTP error format
    const httpError = { error: { message: 'HTTP error' } };
    expect((component as any).extractErrorMessage(httpError)).toBe('HTTP error');
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