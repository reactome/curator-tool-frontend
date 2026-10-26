// Imported first for its side effect, as in instance-list-view.component.spec.ts: the panel pulls
// in ListInstancesModule, which is part of an import cycle through MatchResolutionService.
import '../instance/components/match-instances-dialog/match-instances-dialog.component';

import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject, of, throwError } from 'rxjs';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { ListInstancesModule } from 'src/app/schema-view/list-instances/list-instances.module';
import { NLQueryPanelComponent } from './nl-query-panel.component';
import { NLQueryResponse, NLQueryService } from './nl-query.service';
import { DataService } from 'src/app/core/services/data.service';
import { ResultListingService } from './result-listing.service';

/** Stands in for the real instance list, which needs the whole schema view behind it. */
@Component({ selector: 'app-instance-list-view', standalone: true, template: '' })
class StubInstanceListViewComponent {
  @Input() useRoute = true;
  @Input() openInNewTab = false;
  @Input() sourceInstances?: Instance[];
  @Input() setClassName = '';
  @Input() actionButtons: unknown[] = [];
  @Input() needSecondaryActions = true;
  @Input() showDeletion = true;
  @Input() showBatchEdit = true;
  @Input() showCompare = true;
  @Input() showBulkBookmark = false;
}

describe('NLQueryPanelComponent', () => {
  let fixture: ComponentFixture<NLQueryPanelComponent>;
  let component: NLQueryPanelComponent;
  let service: jasmine.SpyObj<NLQueryService>;
  let resultListing: ResultListingService;

  const response = (overrides: Partial<NLQueryResponse> = {}): NLQueryResponse => ({
    answer: 'Two reactions have no catalyst.',
    queries: [{ cypher: 'MATCH (r:ReactionlikeEvent) RETURN r.dbId AS dbId', params: {}, ok: true, row_count: 2 }],
    columns: ['dbId', 'displayName'],
    rows: [{ dbId: 123, displayName: 'A' }, { dbId: 456, displayName: 'B' }],
    rows_truncated: false,
    model: 'claude-opus-5-5',
    ...overrides,
  });

  const listView = (): StubInstanceListViewComponent | undefined => {
    const el = fixture.debugElement.query(d => d.componentInstance instanceof StubInstanceListViewComponent);
    return el?.componentInstance;
  };

  const askFor = (r: NLQueryResponse) => {
    service.ask.and.returnValue(of(r));
    component.question = 'x';
    component.ask();
    fixture.detectChanges();
  };

  const showTable = () => {
    (fixture.nativeElement.querySelectorAll('mat-button-toggle button') as NodeListOf<HTMLElement>)
      .forEach(b => { if (b.textContent?.includes('Table')) b.click(); });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<NLQueryService>('NLQueryService', ['ask']);
    await TestBed.configureTestingModule({
      imports: [NLQueryPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: NLQueryService, useValue: service },
        // A flat schema, which is all the listing needs to name the instances' class.
        { provide: DataService, useValue: { getSchemaClass: (name: string) => ({ name }) } },
      ],
    })
      .overrideComponent(NLQueryPanelComponent, {
        remove: { imports: [ListInstancesModule] },
        add: { imports: [StubInstanceListViewComponent] },
      })
      .compileComponents();

    resultListing = TestBed.inject(ResultListingService);
    spyOn(resultListing, 'listing').and.callThrough();
    fixture = TestBed.createComponent(NLQueryPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sends the question and shows the answer', () => {
    service.ask.and.returnValue(of(response()));
    component.question = '  Which reactions have no catalyst?  ';

    component.ask();
    fixture.detectChanges();

    expect(service.ask).toHaveBeenCalledWith('Which reactions have no catalyst?', []);
    expect(component.question).toBe('');
    expect(fixture.nativeElement.querySelector('.nlq-answer').textContent).toContain('Two reactions have no catalyst.');
  });

  it('renders the answer as markdown', () => {
    service.ask.and.returnValue(of({ ...response(), answer: 'Found **two**:\n- R1\n- R2' }));
    component.question = 'Which reactions have no catalyst?';

    component.ask();
    fixture.detectChanges();

    const answer: HTMLElement = fixture.nativeElement.querySelector('.nlq-answer');
    expect(answer.querySelector('strong')?.textContent).toBe('two');
    expect(Array.from(answer.querySelectorAll('li')).map(li => li.textContent)).toEqual(['R1', 'R2']);
  });

  it('sends earlier answered exchanges as history, so follow-ups keep their context', () => {
    service.ask.and.returnValue(of(response()));
    component.question = 'Which reactions have no catalyst?';
    component.ask();
    service.ask.and.returnValue(throwError(() => new HttpErrorResponse({ status: 502 })));
    component.question = 'And in mouse?';
    component.ask();
    service.ask.and.returnValue(of(response()));

    component.question = 'Only the human ones';
    component.ask();

    // The failed exchange has no answer, so it is left out.
    expect(service.ask.calls.mostRecent().args).toEqual(['Only the human ones', [
      { role: 'user', content: 'Which reactions have no catalyst?' },
      { role: 'assistant', content: 'Two reactions have no catalyst.' },
    ]]);
  });

  it('ignores a blank question and a second question while one is pending', () => {
    component.question = '   ';
    component.ask();
    expect(service.ask).not.toHaveBeenCalled();

    service.ask.and.returnValue(new Subject<NLQueryResponse>());
    component.question = 'First';
    component.ask();
    component.question = 'Second';
    component.ask();

    expect(service.ask).toHaveBeenCalledTimes(1);
  });

  it('shows the error detail the service returned', () => {
    service.ask.and.returnValue(throwError(() =>
      new HttpErrorResponse({ status: 400, error: { detail: 'Question is too long.' } })));
    component.question = 'x';

    component.ask();

    expect(component.exchanges[0].error).toBe('Question is too long.');
    expect(component.loading).toBeFalse();
  });

  it('says the session expired on a 401, and that the service is unreachable on a 0 or 404', () => {
    for (const [status, message] of [
      [401, 'Your session has expired. Please log in again.'],
      [0, 'The graph query service is not reachable from here.'],
      [404, 'The graph query service is not reachable from here.'],
    ] as const) {
      service.ask.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      component.question = 'x';
      component.ask();
      expect(component.exchanges[component.exchanges.length - 1].error).toBe(message);
    }
  });

  it('emits the dbId when a dbId cell is clicked', () => {
    const selected: number[] = [];
    component.dbIdSelected.subscribe(id => selected.push(id));
    askFor(response());
    showTable();

    const links = fixture.nativeElement.querySelectorAll('.nlq-table a');
    expect(links.length).toBe(2);
    links[1].click();

    expect(selected).toEqual([456]);
  });

  it('treats dbId-named columns as links and nothing else', () => {
    expect(component.isDbIdColumn('dbId')).toBeTrue();
    expect(component.isDbIdColumn('r.dbId')).toBeTrue();
    expect(component.isDbIdColumn('catalyst_dbId')).toBeTrue();
    expect(component.isDbIdColumn('displayName')).toBeFalse();
    expect(component.isDbIdColumn('dbIdCount')).toBeFalse();
  });

  it('does not emit a dbId that is not a number', () => {
    const selected: number[] = [];
    component.dbIdSelected.subscribe(id => selected.push(id));

    component.selectDbId('R-HSA-109582');

    expect(selected).toEqual([]);
  });

  it('lists a result with dbIds in the instance list, from its own rows, opening instances in a new tab', () => {
    askFor(response({
      columns: ['r.dbId', 'r.displayName', 'r.schemaClass'],
      rows: [{ 'r.dbId': 123, 'r.displayName': 'A', 'r.schemaClass': 'Reaction' },
             { 'r.dbId': 456, 'r.displayName': 'B', 'r.schemaClass': 'Reaction' }],
    }));

    const view = listView()!;
    expect(view).toBeDefined();
    expect(view.useRoute).toBeFalse();
    expect(view.openInNewTab).toBeTrue();
    expect(view.setClassName).toBe('Reaction');
    expect(view.sourceInstances).toEqual([
      { dbId: 123, displayName: 'A', schemaClassName: 'Reaction' },
      { dbId: 456, displayName: 'B', schemaClassName: 'Reaction' },
    ]);
    expect(fixture.nativeElement.querySelector('.nlq-table')).toBeNull();
  });

  it('lists the instances a query collected into a list of maps', () => {
    // The shape the query agent actually returns for "which reactions ...?": a count, and a
    // sample collected as maps with aliased keys.
    askFor(response({
      columns: ['total', 'sample'],
      rows: [{ total: 2, sample: [
        { stId: 'R-HSA-1', dbId: 11, name: 'First', cls: 'Reaction' },
        { stId: 'R-HSA-2', dbId: 12, name: 'Second', cls: 'Reaction' },
      ] }],
    }));

    expect(component.exchanges[0].sources).toEqual(['sample.dbId']);
    expect(listView()!.setClassName).toBe('Reaction');
    expect(listView()!.sourceInstances).toEqual([
      { dbId: 11, displayName: 'First', schemaClassName: 'Reaction' },
      { dbId: 12, displayName: 'Second', schemaClassName: 'Reaction' },
    ]);
  });

  it('switches to the raw rows and back', () => {
    askFor(response());

    showTable();
    expect(listView()).toBeUndefined();
    expect(fixture.nativeElement.querySelectorAll('.nlq-table tbody tr').length).toBe(2);

    (fixture.nativeElement.querySelectorAll('mat-button-toggle button') as NodeListOf<HTMLElement>)
      .forEach(b => { if (b.textContent?.includes('List')) b.click(); });
    fixture.detectChanges();
    expect(listView()).toBeDefined();
  });

  it('shows the plain table, with no list controls, for a result without dbIds', () => {
    askFor(response({ columns: ['count', 'sample'], rows: [{ count: 3, sample: [{ stId: 'R-HSA-1' }] }] }));

    expect(resultListing.listing).not.toHaveBeenCalled();
    expect(listView()).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.nlq-result-controls')).toBeNull();
    expect(fixture.nativeElement.querySelector('.nlq-table')).not.toBeNull();
  });

  it('lists another source when it is picked, building each one once', () => {
    askFor(response({
      columns: ['r.dbId', 'c.dbId'],
      rows: [{ 'r.dbId': 1, 'c.dbId': 2 }],
    }));
    expect(listView()!.sourceInstances![0].dbId).toBe(1);

    const exchange = component.exchanges[0];
    component.showSource(exchange, 'c.dbId');
    fixture.detectChanges();
    expect(listView()!.sourceInstances![0].dbId).toBe(2);

    component.showSource(exchange, 'r.dbId');
    fixture.detectChanges();
    expect(listView()!.sourceInstances![0].dbId).toBe(1);
    expect(resultListing.listing).toHaveBeenCalledTimes(2);
  });
});
