import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject, of, throwError } from 'rxjs';

import { NLQueryPanelComponent } from './nl-query-panel.component';
import { NLQueryResponse, NLQueryService } from './nl-query.service';

describe('NLQueryPanelComponent', () => {
  let fixture: ComponentFixture<NLQueryPanelComponent>;
  let component: NLQueryPanelComponent;
  let service: jasmine.SpyObj<NLQueryService>;

  const response = (overrides: Partial<NLQueryResponse> = {}): NLQueryResponse => ({
    answer: 'Two reactions have no catalyst.',
    queries: [{ cypher: 'MATCH (r:ReactionlikeEvent) RETURN r.dbId AS dbId', params: {}, ok: true, row_count: 2 }],
    columns: ['dbId', 'displayName'],
    rows: [{ dbId: 123, displayName: 'A' }, { dbId: 456, displayName: 'B' }],
    rows_truncated: false,
    model: 'claude-opus-5-5',
    ...overrides,
  });

  beforeEach(async () => {
    service = jasmine.createSpyObj<NLQueryService>('NLQueryService', ['ask']);
    await TestBed.configureTestingModule({
      imports: [NLQueryPanelComponent, NoopAnimationsModule],
      providers: [{ provide: NLQueryService, useValue: service }],
    }).compileComponents();

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
    service.ask.and.returnValue(of(response()));
    const selected: number[] = [];
    component.dbIdSelected.subscribe(id => selected.push(id));
    component.question = 'x';
    component.ask();
    fixture.detectChanges();

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
});
