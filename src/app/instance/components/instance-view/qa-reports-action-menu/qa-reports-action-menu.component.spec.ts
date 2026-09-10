import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { componentTestImports, makeInstance } from 'src/testing';
import { QAReportsActionMenuComponent } from './qa-reports-action-menu.component';

describe('QAReportsActionMenuComponent', () => {
  let component: QAReportsActionMenuComponent;
  let fixture: ComponentFixture<QAReportsActionMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [QAReportsActionMenuComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(QAReportsActionMenuComponent);
    component = fixture.componentInstance;
  });

  it('shows no QA issues before an instance is bound', () => {
    component.ngOnChanges();

    expect(component.qaIssueKeys).toEqual([]);
  });

  it('lists the QA issue labels of the bound instance', () => {
    component.instance = makeInstance({
      dbId: 100,
      qaIssues: new Map<string, string[][]>([
        ['Missing species', [['102', 'species is empty']]],
        ['Compartment mismatch', [['101', 'compartment differs from input']]]
      ])
    });

    component.ngOnChanges();

    expect(component.qaIssueKeys).toEqual(['Missing species', 'Compartment mismatch']);
  });

  it('leaves the labels untouched for an instance with no QA issues', () => {
    component.qaIssueKeys = ['stale'];
    component.instance = makeInstance({ dbId: 100 });

    component.ngOnChanges();

    // qaIssues is undefined, so the component makes no claim about the issues either way.
    expect(component.qaIssueKeys).toEqual(['stale']);
  });

  it('emits the chosen action so the parent view can handle it', () => {
    const emitted: string[] = [];
    component.actionItem.subscribe(a => emitted.push(a));

    component.onClick('Missing species');

    expect(emitted).toEqual(['Missing species']);
  });

  it('hides the panel once an action has been chosen', () => {
    expect(component.hidePanel).toBeFalse();

    component.onClick('Missing species');

    expect(component.hidePanel).toBeTrue();
  });
});
