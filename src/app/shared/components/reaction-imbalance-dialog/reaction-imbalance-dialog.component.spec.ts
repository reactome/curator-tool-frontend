import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ReactionImbalanceReport } from 'src/app/core/models/reaction-imbalance.model';
import { DataService } from 'src/app/core/services/data.service';
import { createDataServiceSpy, createRouterStub, provideDialogContext } from 'src/testing';
import { REACTION_IMBALANCE_REPORT } from 'src/testing/api-fixtures';
import { ReactionImbalanceDialogComponent } from './reaction-imbalance-dialog.component';

describe('ReactionImbalanceDialogComponent', () => {
  let fixture: ComponentFixture<ReactionImbalanceDialogComponent>;
  let component: ReactionImbalanceDialogComponent;
  let dataService: jasmine.SpyObj<DataService>;
  let el: HTMLElement;

  /** A fresh copy, so a spec that edits the report cannot leak into another. */
  function report(overrides: Partial<ReactionImbalanceReport> = {}): ReactionImbalanceReport {
    return { ...structuredClone(REACTION_IMBALANCE_REPORT), ...overrides };
  }

  function build(response: Observable<ReactionImbalanceReport>) {
    dataService = createDataServiceSpy();
    dataService.checkReactionImbalance.and.returnValue(response);
    TestBed.configureTestingModule({
      imports: [ReactionImbalanceDialogComponent, NoopAnimationsModule],
      providers: [
        ...provideDialogContext({ dbId: 100, displayName: 'Glycolysis' }),
        { provide: DataService, useValue: dataService },
        { provide: Router, useValue: createRouterStub() },
      ],
    });
    fixture = TestBed.createComponent(ReactionImbalanceDialogComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  function reactionRows(): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>('tr.reaction-row'));
  }

  function text(): string {
    return el.textContent?.replace(/\s+/g, ' ') ?? '';
  }

  function setHideCleavage(hide: boolean) {
    component.onHideCleavageChange(hide);
    fixture.detectChanges();
  }

  it('runs the check for the event it was opened on', () => {
    build(of(report()));
    expect(dataService.checkReactionImbalance).toHaveBeenCalledOnceWith(100);
  });

  it('shows a spinner until the report arrives', () => {
    const response = new Subject<ReactionImbalanceReport>();
    build(response);
    expect(el.querySelector('mat-spinner')).not.toBeNull();

    response.next(report());
    fixture.detectChanges();

    expect(el.querySelector('mat-spinner')).toBeNull();
    expect(reactionRows().length).toBe(1);
  });

  it('hides cleavage reactions by default and leaves them out of the header count', () => {
    build(of(report()));

    expect(component.hideCleavage).toBeTrue();
    const rows = reactionRows();
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('APC is deubiquitinated');
    expect(text()).toContain('Glycolysis: 1 imbalanced of 3 reactions checked');
    expect(text()).not.toContain('cleavage)');
    expect(component.displayedColumns).not.toContain('cleavage');
  });

  it('shows cleavage reactions, their count and the cleavage column when the toggle is off', () => {
    build(of(report()));
    setHideCleavage(false);

    const rows = reactionRows();
    expect(rows.length).toBe(2);
    expect(text()).toContain('Glycolysis: 2 imbalanced of 3 reactions checked (1 cleavage)');
    expect(component.displayedColumns).toContain('cleavage');
    const cleavageRow = rows.find(row => row.textContent!.includes('Autoproteolytic'))!;
    expect(cleavageRow.querySelector('.cleavage-icon')).not.toBeNull();
  });

  it('expands a reaction to one row per protein with a signed delta, and collapses it again', () => {
    build(of(report()));
    setHideCleavage(false);
    const cleavageRow = reactionRows().find(row => row.textContent!.includes('Autoproteolytic'))!;

    cleavageRow.click();
    fixture.detectChanges();

    expect(component.expandedReaction?.dbId).toBe(5358340);
    expect(cleavageRow.classList).toContain('expanded-row');

    cleavageRow.click();
    fixture.detectChanges();

    expect(component.expandedReaction).toBeUndefined();
    expect(cleavageRow.classList).not.toContain('expanded-row');
  });

  it('renders each imbalanced protein with its counts', () => {
    build(of(report()));
    // The detail table is in the DOM (collapsed to zero height) for every reaction row.
    const proteinRows = Array.from(el.querySelectorAll<HTMLElement>('tr.detail-protein-row'));
    expect(proteinRows.length).toBe(1);
    const cells = Array.from(proteinRows[0].querySelectorAll('td')).map(td => td.textContent!.trim());
    expect(cells).toEqual(['UniProt:P0CG48 UBC', 'P0CG48', '27', '9', '-18']);
  });

  it('formats a positive delta with a plus sign', () => {
    build(of(report()));
    expect(component.formatDelta(1, 2)).toBe('+1');
    expect(component.formatDelta(27, 9)).toBe('-18');
  });

  it('collapses the expanded reaction when the toggle hides it', () => {
    build(of(report()));
    setHideCleavage(false);
    component.toggleExpanded(component.allReactions.find(r => r.cleavage)!);

    setHideCleavage(true);

    expect(component.expandedReaction).toBeUndefined();
  });

  it('filters on reaction name and protein identifier', () => {
    build(of(report()));
    setHideCleavage(false);

    component.onFilterChange('O43323');
    fixture.detectChanges();
    expect(reactionRows().map(row => row.textContent)).toEqual([jasmine.stringContaining('Autoproteolytic')]);

    component.onFilterChange('apc is');
    fixture.detectChanges();
    expect(reactionRows().map(row => row.textContent)).toEqual([jasmine.stringContaining('APC is deubiquitinated')]);

    component.onFilterChange('nothing like this');
    fixture.detectChanges();
    expect(reactionRows().length).toBe(0);
    expect(text()).toContain('No reactions match the filter.');
  });

  it('says every reaction is balanced when nothing comes back', () => {
    build(of(report({ checkedReactions: 7, reactions: [] })));
    expect(text()).toContain('All 7 reactions are balanced.');
    expect(reactionRows().length).toBe(0);
  });

  it('says how many cleavage reactions are hidden when the toggle hides everything', () => {
    const onlyCleavage = report();
    onlyCleavage.reactions = onlyCleavage.reactions.filter(r => r.cleavage);
    build(of(onlyCleavage));

    expect(reactionRows().length).toBe(0);
    expect(text()).toContain('No imbalanced reactions other than 1 hidden cleavage reaction.');
  });

  it('says there is nothing to check when the event has no reactions', () => {
    build(of(report({ checkedReactions: 0, reactions: [] })));
    expect(text()).toContain('No reactions found under this event.');
    expect(el.querySelector('mat-slide-toggle')).toBeNull();
  });

  it('shows the error message and stops the spinner when the check fails', () => {
    build(throwError(() => new Error('Instance 42 is not an Event')));

    expect(el.querySelector('mat-spinner')).toBeNull();
    expect(text()).toContain('The check could not be run: Instance 42 is not an Event');
  });

  it('opens a reaction in the instance view from its DB_ID without toggling the row', () => {
    build(of(report()));
    const open = spyOn(window, 'open').and.returnValue({} as Window);

    el.querySelector<HTMLElement>('.db-id-link')!.click();
    fixture.detectChanges();

    expect(open).toHaveBeenCalledWith('schema_view/instance/9666616', '_blank');
    expect(component.expandedReaction).toBeUndefined();
  });

  it('falls back to in-app navigation when a new tab cannot be opened', () => {
    build(of(report()));
    spyOn(window, 'open').and.returnValue(null);
    const router = TestBed.inject(Router);
    const dialogRef = TestBed.inject(MatDialogRef);

    component.openInstance(9666616);

    expect(dialogRef.close).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/schema_view/instance/9666616');
  });

  it('exports the visible reactions to TSV, one line per protein', async () => {
    build(of(report()));
    setHideCleavage(false);
    let blob: Blob | undefined;
    spyOn(window.URL, 'createObjectURL').and.callFake((b: Blob | MediaSource) => {
      blob = b as Blob;
      return 'blob:test';
    });
    spyOn(window.URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');

    component.exportTsv();

    const lines = (await blob!.text()).trim().split('\n');
    expect(lines[0]).toBe('Reaction DB_ID\tReaction\tCleavage\tLast author\tProtein\tIdentifier\tInput\tOutput');
    expect(lines.length).toBe(4); // header + two cleavage proteins + one ubiquitin protein
    expect(lines).toContain('9666616\tAPC is deubiquitinated\tfalse\t\tUniProt:P0CG48 UBC\tP0CG48\t27\t9');
    expect(lines).toContain(
      '5358340\tAutoproteolytic cleavage of Hh precursors\ttrue\tMatthews, Lisa, 2023-03-08\tUniProt:O43323 DHH\tO43323\t1\t2');
  });
});
