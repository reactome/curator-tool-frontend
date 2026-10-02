import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { UsageEntry, UsageReport, UsageStep, UsageStepRow } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';
import { PaperAnnotationModule } from '../../paper-annotation.module';
import { UsagePanelComponent } from './usage-panel.component';

describe('UsagePanelComponent', () => {
  const zero = { calls: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 };
  const row = (step: UsageStep, c: Partial<typeof zero>, saved = false): UsageStepRow => {
    const x = { ...zero, ...c };
    return { step, ...x, total_tokens: x.input_tokens + x.output_tokens, saved };
  };
  const sum = (rows: UsageStepRow[]) => {
    const t = { ...zero, total_tokens: 0 };
    rows.forEach(r => { (Object.keys(zero) as (keyof typeof zero)[]).forEach(k => t[k] += r[k]); t.total_tokens += r.total_tokens; });
    return t;
  };
  const report = (steps: UsageStepRow[], over: Partial<UsageReport> = {}): UsageReport => ({
    source: 'run', entries: [], steps, totals: sum(steps), spent_now: sum(steps.filter(s => !s.saved)), ...over });
  const entry = (step: UsageStep, detail: string, at: number, c: Partial<typeof zero>): UsageEntry =>
    ({ step, detail, at, model: null, ...zero, ...c });

  let api: jasmine.SpyObj<LlmApiService>;
  let fixture: ComponentFixture<UsagePanelComponent>;
  let component: UsagePanelComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const cells = (tr: Element) => Array.from(tr.querySelectorAll('th,td')).map(c => c.textContent!.replace(/\s+/g, ' ').trim());
  const bodyRows = () => Array.from(el().querySelectorAll('table[aria-label="Tokens used by each step"] tbody tr')).map(cells);
  const footRows = () => Array.from(el().querySelectorAll('table[aria-label="Tokens used by each step"] tfoot tr')).map(cells);

  const create = (result: UsageReport | Error) => {
    api = jasmine.createSpyObj('LlmApiService', ['usage']);
    api.usage.and.returnValue(result instanceof Error ? throwError(() => result) : of(result));
    TestBed.configureTestingModule({
      imports: [PaperAnnotationModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: LlmApiService, useValue: api }]
    });
    fixture = TestBed.createComponent(UsagePanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sessionId', 's1');
    fixture.detectChanges();
  };

  it('lists each step in plain words with thousands separators and a total', () => {
    create(report([row('extraction', { calls: 20, input_tokens: 142247, output_tokens: 60586 }),
                   row('merge', { calls: 233, input_tokens: 394020, output_tokens: 22021 })]));
    expect(api.usage).toHaveBeenCalledWith('s1');
    expect(bodyRows()).toEqual([
      ['Reading the paper (extraction)', '20', '142,247', '60,586', '202,833'],
      ['Merging duplicate reactions', '233', '394,020', '22,021', '416,041']]);
    expect(footRows()).toEqual([['Total', '253', '536,267', '82,607', '618,874']]);
    expect(text()).not.toContain('Spent in this session');
    expect(text()).not.toContain('saved run');
  });

  it('leaves the cache columns out when the provider reported no cache use', () => {
    create(report([row('draft', { calls: 1, input_tokens: 100, output_tokens: 10 })]));
    expect(text()).not.toContain('Cache read');
  });

  it('shows the cache columns when the provider reported cache use', () => {
    create(report([row('draft', { calls: 1, input_tokens: 100, output_tokens: 10, cache_read_tokens: 4000, cache_write_tokens: 25 })]));
    expect(text()).toContain('Cache read');
    expect(bodyRows()[0]).toEqual(['Building the Reactome draft', '1', '100', '10', '4,000', '25', '110']);
  });

  describe('a replayed annotation', () => {
    const steps = [row('extraction', { calls: 20, input_tokens: 1000, output_tokens: 200 }, true),
                   row('chat', { calls: 2, input_tokens: 70, output_tokens: 7 })];

    it('marks the saved rows, and separates what was spent in this session', () => {
      create(report(steps, { source: 'saved' }));
      expect(bodyRows()[0][0]).toContain('saved run');
      expect(bodyRows()[1][0]).not.toContain('saved run');                    // chat done here is live
      expect(footRows()).toEqual([['All steps', '22', '1,070', '207', '1,277'],
                                  ['Spent in this session', '2', '70', '7', '77']]);
      expect(text()).toContain('reused from a saved result');
    });
  });

  it('says so when nothing was recorded', () => {
    create(report([]));
    expect(text()).toContain('No model usage was recorded for this annotation.');
    expect(el().querySelector('table')).toBeNull();
  });

  it('shows why the usage could not be read', () => {
    create(new LlmApiError(404, 'no such session'));
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('no such session');
  });

  it('reloads when told something that spends tokens happened', () => {
    create(report([row('chat', { calls: 1, input_tokens: 100, output_tokens: 10 })]));
    api.usage.and.returnValue(of(report([row('chat', { calls: 2, input_tokens: 300, output_tokens: 30 })])));
    fixture.componentRef.setInput('stamp', 1);
    fixture.detectChanges();
    expect(api.usage).toHaveBeenCalledTimes(2);
    expect(bodyRows()[0]).toEqual(['Chat', '2', '300', '30', '330']);
  });

  it('breaks the reaction checks and chat turns down one by one, oldest first', () => {
    create(report([row('qa', { calls: 1, input_tokens: 3219, output_tokens: 787 }), row('chat', { calls: 3, input_tokens: 9000, output_tokens: 100 })],
      { entries: [entry('chat', 'turn 2', 30, { calls: 1, input_tokens: 4000, output_tokens: 40 }),
                  entry('qa', 'r2', 10, { calls: 1, input_tokens: 3219, output_tokens: 787 }),
                  entry('chat', 'turn 1', 20, { calls: 2, input_tokens: 5000, output_tokens: 60 }),
                  entry('extraction', '', 1, { calls: 20, input_tokens: 1 })] }));
    const rows = Array.from(el().querySelectorAll('details tbody tr')).map(cells);
    expect(rows).toEqual([['Check of reaction r2', '1', '3,219', '787'],
                          ['Chat, turn 1', '2', '5,000', '60'],
                          ['Chat, turn 2', '1', '4,000', '40']]);
  });

  it('has no breakdown section when there were no checks or chat', () => {
    create(report([row('extraction', { calls: 1, input_tokens: 1, output_tokens: 1 })], { entries: [entry('extraction', '', 1, { calls: 1 })] }));
    expect(el().querySelector('details')).toBeNull();
  });

  it('explains which steps are not listed because they use no model', () => {
    create(report([row('chat', { calls: 1, input_tokens: 1, output_tokens: 1 })]));
    expect(text()).toContain('use no model, so they are not listed');
  });
});
