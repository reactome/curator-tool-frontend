import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { createRouterStub, provideDialogContext } from 'src/testing';
import { REACTION_IMBALANCE_QA_RESULT } from 'src/testing/api-fixtures';
import {
  groupReactionImbalanceRows,
  isPathwayReactionImbalance,
  ReactionImbalanceTable
} from './reaction-imbalance-table.component';

describe('ReactionImbalanceTable', () => {
  let fixture: ComponentFixture<ReactionImbalanceTable>;
  let component: ReactionImbalanceTable;
  let el: HTMLElement;

  /** Fresh copies, so a spec that edits the rows cannot leak into another. */
  const columns = () => [...REACTION_IMBALANCE_QA_RESULT.columns];
  const rows = () => structuredClone(REACTION_IMBALANCE_QA_RESULT.rows);

  function build(tableRows: string[][] = rows(), tableColumns: string[] = columns()) {
    TestBed.configureTestingModule({
      imports: [ReactionImbalanceTable, NoopAnimationsModule],
      providers: [
        ...provideDialogContext({}),
        { provide: Router, useValue: createRouterStub() },
      ],
    });
    fixture = TestBed.createComponent(ReactionImbalanceTable);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('columns', tableColumns);
    fixture.componentRef.setInput('rows', tableRows);
    fixture.componentRef.setInput('eventDbId', 100);
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

  it('recognises only the Pathway form of the reaction imbalance check', () => {
    expect(isPathwayReactionImbalance(REACTION_IMBALANCE_QA_RESULT)).toBeTrue();
    // The Reaction form has no Reaction_DBID column and stays in the generic table.
    expect(isPathwayReactionImbalance({
      checkName: 'Reaction Imbalance Check', passed: false,
      columns: ['Reference', 'Identifier', 'Input', 'Output'], rows: [['UniProt:O43323 DHH', 'O43323', '1', '2']]
    })).toBeFalse();
    expect(isPathwayReactionImbalance({ ...REACTION_IMBALANCE_QA_RESULT, checkName: 'Something else' })).toBeFalse();
  });

  it('groups the rows by reaction, keeping the order they came in', () => {
    const reactions = groupReactionImbalanceRows(columns(), rows());

    expect(reactions.map(r => r.dbId)).toEqual([9666616, 5358340]);
    expect(reactions[1]).toEqual({
      dbId: 5358340,
      displayName: 'Autoproteolytic cleavage of Hh precursors',
      cleavage: true,
      lastAuthor: 'Matthews, Lisa, 2023-03-08',
      imbalances: [
        { displayName: 'UniProt:O43323 DHH', identifier: 'O43323', inputCount: 1, outputCount: 2 },
        { displayName: 'UniProt:Q15465 SHH', identifier: 'Q15465', inputCount: 1, outputCount: 2 },
      ],
    });
    expect(reactions[0].cleavage).toBeFalse();
    expect(reactions[0].lastAuthor).toBe('');
  });

  it('finds values by column name, not position', () => {
    const order = columns().reverse();
    const reordered = rows().map(row => [...row].reverse());

    expect(groupReactionImbalanceRows(order, reordered)).toEqual(groupReactionImbalanceRows(columns(), rows()));
  });

  it('hides cleavage reactions and the cleavage column by default', () => {
    build();

    expect(component.hideCleavage).toBeTrue();
    const shown = reactionRows();
    expect(shown.length).toBe(1);
    expect(shown[0].textContent).toContain('APC is deubiquitinated');
    expect(component.displayedColumns).not.toContain('cleavage');
  });

  it('shows cleavage reactions and the cleavage column when the toggle is off', () => {
    build();
    setHideCleavage(false);

    const shown = reactionRows();
    expect(shown.length).toBe(2);
    expect(component.displayedColumns).toContain('cleavage');
    const cleavageRow = shown.find(row => row.textContent!.includes('Autoproteolytic'))!;
    expect(cleavageRow.querySelector('.cleavage-icon')).not.toBeNull();
  });

  it('expands a reaction to one row per protein with a signed delta, and collapses it again', () => {
    build();
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
    build();
    // The detail table is in the DOM (collapsed to zero height) for every reaction row.
    const proteinRows = Array.from(el.querySelectorAll<HTMLElement>('tr.detail-protein-row'));
    expect(proteinRows.length).toBe(1);
    const cells = Array.from(proteinRows[0].querySelectorAll('td')).map(td => td.textContent!.trim());
    expect(cells).toEqual(['UniProt:P0CG48 UBC', 'P0CG48', '27', '9', '-18']);
  });

  it('formats a positive delta with a plus sign', () => {
    build();
    expect(component.formatDelta(1, 2)).toBe('+1');
    expect(component.formatDelta(27, 9)).toBe('-18');
  });

  it('collapses the expanded reaction when the toggle hides it', () => {
    build();
    setHideCleavage(false);
    component.toggleExpanded(component.allReactions.find(r => r.cleavage)!);

    setHideCleavage(true);

    expect(component.expandedReaction).toBeUndefined();
  });

  it('filters on reaction name and protein identifier', () => {
    build();
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

  it('says how many possible cleavages are hidden when the toggle hides everything', () => {
    build(rows().filter(row => row[6] === 'Yes'));

    expect(reactionRows().length).toBe(0);
    expect(text()).toContain('No imbalanced reactions other than 1 hidden possible cleavage.');
  });

  it('opens a reaction in the instance view from its DB_ID without toggling the row', () => {
    build();
    const open = spyOn(window, 'open').and.returnValue({} as Window);

    el.querySelector<HTMLElement>('.db-id-link')!.click();
    fixture.detectChanges();

    expect(open).toHaveBeenCalledWith('schema_view/instance/9666616', '_blank');
    expect(component.expandedReaction).toBeUndefined();
  });

  it('falls back to in-app navigation, closing the QA report, when a new tab cannot be opened', () => {
    build();
    spyOn(window, 'open').and.returnValue(null);
    const router = TestBed.inject(Router);
    const dialogRef = TestBed.inject(MatDialogRef);

    component.openInstance(9666616);

    expect(dialogRef.close).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/schema_view/instance/9666616');
  });

  it('exports the visible reactions to TSV, one line per protein', async () => {
    build();
    setHideCleavage(false);
    let blob: Blob | undefined;
    spyOn(window.URL, 'createObjectURL').and.callFake((b: Blob | MediaSource) => {
      blob = b as Blob;
      return 'blob:test';
    });
    spyOn(window.URL, 'revokeObjectURL');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    component.exportTsv();

    const lines = (await blob!.text()).trim().split('\n');
    expect(lines[0]).toBe('Reaction DB_ID\tReaction\tCleavage\tLast author\tProtein\tIdentifier\tInput\tOutput');
    expect(lines.length).toBe(4); // header + two cleavage proteins + one ubiquitin protein
    expect(lines).toContain('9666616\tAPC is deubiquitinated\tfalse\t\tUniProt:P0CG48 UBC\tP0CG48\t27\t9');
    expect(lines).toContain(
      '5358340\tAutoproteolytic cleavage of Hh precursors\ttrue\tMatthews, Lisa, 2023-03-08\tUniProt:O43323 DHH\tO43323\t1\t2');
    expect((click.calls.mostRecent().object as HTMLAnchorElement).download).toBe('reaction_imbalance_100.tsv');
  });
});
