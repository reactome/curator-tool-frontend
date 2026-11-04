import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Subject, of, throwError } from 'rxjs';

import { DiagramSyncIssue, DiagramSyncReport } from 'src/app/core/models/diagram-sync.model';
import { DataService } from 'src/app/core/services/data.service';
import {
  commonTestProviders,
  componentTestImports,
  makeInstance,
  provideDialogContext
} from 'src/testing';
import { DiagramSyncDialogComponent } from './diagram-sync-dialog.component';

function makeIssue(overrides: Partial<DiagramSyncIssue> = {}): DiagramSyncIssue {
  return {
    diagramDbId: 1430727,
    pathwayDbId: 1430728,
    pathwayDisplayName: 'Metabolism',
    eventDbId: 70171,
    eventDisplayName: 'Glycolysis step',
    eventSchemaClass: 'Reaction',
    issue: 'input out of sync',
    ...overrides
  };
}

function makeReport(issues: DiagramSyncIssue[], overrides: Partial<DiagramSyncReport> = {}): DiagramSyncReport {
  return {
    eventDbId: 1430728,
    eventDisplayName: 'Metabolism',
    checkedDiagrams: 118,
    uncheckedDiagramDbIds: [],
    issues,
    ...overrides
  };
}

const PRECEDING_ISSUE = makeIssue({
  eventDbId: 556833,
  eventDisplayName: 'Metabolism of lipids',
  eventSchemaClass: 'Pathway',
  issue: 'precedingEvent out of sync: missing 1428517',
  missingPrecedingEventDbId: 1428517,
  created: "D'Eustachio, P, 2010-03-23",
  modified: 'Weiser, Joel, 2023-10-12'
});

/** An issue in a second diagram, the sub-pathway Glycolysis's own. */
const GLYCOLYSIS_ISSUE = makeIssue({
  diagramDbId: 70326,
  pathwayDbId: 70171,
  pathwayDisplayName: 'Glycolysis',
  eventDbId: 70421,
  eventDisplayName: 'Aldolase cleaves fructose',
  issue: 'catalyst out of sync'
});

describe('DiagramSyncDialogComponent', () => {
  const pathway = makeInstance({ dbId: 1430728, displayName: 'Metabolism', schemaClassName: 'Pathway' });
  let dataService: jasmine.SpyObj<DataService>;

  /** Builds the dialog with the check answering `answer`. */
  function build(answer: any): DiagramSyncDialogComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        DiagramSyncDialogComponent,
        ...provideDialogContext({ pathway })
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    dataService.checkDiagramSync.and.returnValue(answer);
    return TestBed.inject(DiagramSyncDialogComponent);
  }

  it('runs the check on the pathway it was opened for', () => {
    build(of(makeReport([])));

    expect(dataService.checkDiagramSync).toHaveBeenCalledOnceWith(1430728);
  });

  it('shows the loading state until the report arrives', () => {
    const answer = new Subject<DiagramSyncReport>();
    const component = build(answer);

    expect(component.loading).toBeTrue();

    answer.next(makeReport([]));

    expect(component.loading).toBeFalse();
    expect(component.report).toBeDefined();
  });

  it('leaves the loading state and keeps the message when the check fails', () => {
    const component = build(throwError(() => new Error('Cannot find instance with dbId: 1430728')));

    expect(component.loading).toBeFalse();
    expect(component.report).toBeUndefined();
    expect(component.errorMessage).toBe('Cannot find instance with dbId: 1430728');
  });

  it('starts out grouped by diagram', () => {
    const component = build(of(makeReport([makeIssue(), GLYCOLYSIS_ISSUE, PRECEDING_ISSUE])));

    // Glycolysis sorts before Metabolism; within Metabolism, by event name.
    expect(component.dataSource.data.map(issue => issue.eventDbId)).toEqual([70421, 70171, 556833]);
  });

  it('lists each diagram that has issues, with its issue count', () => {
    const component = build(of(makeReport([makeIssue(), PRECEDING_ISSUE, GLYCOLYSIS_ISSUE])));

    expect(component.diagrams).toEqual([
      { diagramDbId: 70326, pathwayDbId: 70171, pathwayDisplayName: 'Glycolysis', issueCount: 1 },
      { diagramDbId: 1430727, pathwayDbId: 1430728, pathwayDisplayName: 'Metabolism', issueCount: 2 }
    ]);
  });

  it('narrows the table to one diagram and back to all of them', () => {
    const component = build(of(makeReport([makeIssue(), PRECEDING_ISSUE, GLYCOLYSIS_ISSUE])));

    component.selectDiagram(70326);
    expect(component.dataSource.filteredData.map(issue => issue.eventDbId)).toEqual([70421]);

    component.selectDiagram(undefined);
    expect(component.dataSource.filteredData.length).toBe(3);
  });

  it('drops a diagram filter that a re-run leaves with nothing to show', () => {
    const component = build(of(makeReport([makeIssue(), GLYCOLYSIS_ISSUE])));
    component.selectDiagram(70326);

    // The curator fixed the Glycolysis diagram and ran the check again.
    dataService.checkDiagramSync.and.returnValue(of(makeReport([makeIssue()])));
    component.runCheck();

    expect(component.selectedDiagramDbId).toBeUndefined();
    expect(component.dataSource.filteredData.length).toBe(1);
  });

  it('treats a report the backend sent without issues or unchecked lists as empty', () => {
    // Fields with no value are left out of the JSON rather than sent as null.
    const component = build(of({ eventDbId: 1430728, eventDisplayName: 'Metabolism', checkedDiagrams: 3 }));

    expect(component.issueCount).toBe(0);
    expect(component.uncheckedDiagramDbIds).toEqual([]);
    expect(component.dataSource.data).toEqual([]);
  });

  it('links an event to its instance view', () => {
    const component = build(of(makeReport([])));

    expect(component.instanceUrl(556833)).toBe('schema_view/instance/556833');
  });

  it('highlights both ends of the FlowLine in the issue diagram', () => {
    const component = build(of(makeReport([])));

    // The flagged event first: it is the one the event view's tree and editor open.
    expect(component.highlightInDiagramUrl(PRECEDING_ISSUE))
      .toBe('event_view/instance/1430728?select=556833,1428517');
  });

  it('closes when asked', () => {
    const component = build(of(makeReport([])));

    component.onClose();

    expect(component.dialogRef.close).toHaveBeenCalled();
  });
});

/** The same dialog rendered, for what the curator actually sees. */
describe('DiagramSyncDialogComponent (rendered)', () => {
  const pathway = makeInstance({ dbId: 1430728, displayName: 'Metabolism', schemaClassName: 'Pathway' });
  let fixture: ComponentFixture<DiagramSyncDialogComponent>;

  function render(report: DiagramSyncReport): HTMLElement {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports(), MatTableModule, MatSortModule],
      declarations: [DiagramSyncDialogComponent],
      providers: [...commonTestProviders(), ...provideDialogContext({ pathway })],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    dataService.checkDiagramSync.and.returnValue(of(report));
    fixture = TestBed.createComponent(DiagramSyncDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function eventCells(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('td.mat-column-event'))
      .map(cell => cell.textContent!.trim());
  }

  it('says how many diagrams were checked when there are no issues', () => {
    const element = render(makeReport([], { checkedDiagrams: 118 }));

    expect(element.textContent).toContain('No sync issues found in 118 diagrams.');
    expect(element.querySelector('table')).toBeNull();
  });

  it('says how many diagrams could not be checked', () => {
    const element = render(makeReport([], { uncheckedDiagramDbIds: [111, 222] }));

    expect(element.textContent).toContain("2 diagrams couldn't be checked");
    expect(element.querySelector('.unchecked a[href="schema_view/instance/222"]')).not.toBeNull();
  });

  it('does not mention unchecked diagrams when every diagram was checked', () => {
    const element = render(makeReport([]));

    expect(element.querySelector('.unchecked')).toBeNull();
  });

  it('shows the issue columns, with the event linked to its instance view', () => {
    const element = render(makeReport([PRECEDING_ISSUE]));

    const headers = Array.from(element.querySelectorAll('th')).map(th => th.textContent!.trim());
    expect(headers).toEqual(['Event', 'Type', 'Issue', 'Diagram DB_ID', 'Created', 'Modified']);
    expect(eventCells(element)).toEqual(['Metabolism of lipids [556833]']);
    expect(element.querySelector('td.mat-column-event a')!.getAttribute('href'))
      .toBe('schema_view/instance/556833');
    expect(element.querySelector('td.mat-column-created')!.textContent).toContain("D'Eustachio, P, 2010-03-23");
  });

  it('links the missing precedingEvent and offers to highlight both events', () => {
    const element = render(makeReport([PRECEDING_ISSUE]));

    const links = Array.from(element.querySelectorAll('td.mat-column-issue a')).map(a => a.getAttribute('href'));
    expect(links).toEqual([
      'schema_view/instance/1428517',
      'event_view/instance/1430728?select=556833,1428517'
    ]);
  });

  it('shows other issues as plain text, with no highlight action', () => {
    const element = render(makeReport([makeIssue()]));

    const cell = element.querySelector('td.mat-column-issue')!;
    expect(cell.textContent!.trim()).toBe('input out of sync');
    expect(cell.querySelector('a')).toBeNull();
  });

  it('sets pathway rows apart from reaction rows', () => {
    const element = render(makeReport([makeIssue(), PRECEDING_ISSUE]));

    const rows = Array.from(element.querySelectorAll('tr.mat-mdc-row'));
    // Grouped order: 'Glycolysis step' (a Reaction) before 'Metabolism of lipids' (a Pathway).
    expect(rows.map(row => row.classList.contains('pathway_row'))).toEqual([false, true]);
  });

  it('sorts by a column when its header is clicked', () => {
    const element = render(makeReport([makeIssue(), PRECEDING_ISSUE, GLYCOLYSIS_ISSUE]));

    // The grouped starting order happens to be ascending by event already, so check descending:
    // the first click sorts ascending, the second descending.
    const header = element.querySelector('th.mat-column-event .mat-sort-header-container') as HTMLElement;
    header.click();
    header.click();
    fixture.detectChanges();

    expect(eventCells(element)).toEqual([
      'Metabolism of lipids [556833]',
      'Glycolysis step [70171]',
      'Aldolase cleaves fructose [70421]'
    ]);
  });
});
