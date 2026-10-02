import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom, of, throwError, toArray } from 'rxjs';
import { environment } from 'src/environments/environment.dev';
import { TokenRefreshService } from 'src/app/core/services/token-refresh.service';
import { ChatEvent, Job } from '../models/llm-api.models';
import { LlmApiError, LlmApiService } from './llm-api.service';

const base = environment.llmApiURL;

describe('LlmApiService', () => {
  let service: LlmApiService;
  let http: HttpTestingController;
  let tokenRefresh: jasmine.SpyObj<TokenRefreshService>;

  beforeEach(() => {
    tokenRefresh = jasmine.createSpyObj<TokenRefreshService>('TokenRefreshService', ['refresh']);
    tokenRefresh.refresh.and.returnValue(of('fresh-token'));
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: TokenRefreshService, useValue: tokenRefresh }]
    });
    service = TestBed.inject(LlmApiService);
    http = TestBed.inject(HttpTestingController);
    localStorage.setItem('token', 'tok');
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('token');
  });

  describe('REST calls', () => {
    it('starts an annotation for a PMID with an optional focus', () => {
      service.start('24751536', 'PINK1').subscribe(r => expect(r.sessionId).toBe('s1'));
      const req = http.expectOne(`${base}/sessions`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ pmid: '24751536', focus: 'PINK1' });
      req.flush({ sessionId: 's1', jobId: 'j1' });
    });

    it('sends no focus as null', () => {
      service.start('1234567').subscribe();
      expect(http.expectOne(`${base}/sessions`).request.body).toEqual({ pmid: '1234567', focus: null });
    });

    it('uploads a PDF as multipart with the focus', () => {
      const file = new File(['%PDF-1'], 'paper.pdf', { type: 'application/pdf' });
      service.upload(file, 'PINK1').subscribe();
      const req = http.expectOne(`${base}/sessions/upload`);
      const form = req.request.body as FormData;
      expect((form.get('file') as File).name).toBe('paper.pdf');
      expect(form.get('focus')).toBe('PINK1');
      req.flush({ sessionId: 's', jobId: 'j' });
    });

    it('filters issues by status and updates one', () => {
      service.issues('s1', 'open').subscribe();
      expect(http.expectOne(r => r.url === `${base}/sessions/s1/issues`).request.params.get('status')).toBe('open');
      service.setIssueStatus('s1', 'iss-001', 'dismissed').subscribe();
      const req = http.expectOne(`${base}/sessions/s1/issues/iss-001`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'dismissed' });
    });

    it('searches the paper, runs QA, and decides proposals', () => {
      service.searchPaper('s1', 'CCCP', 'Results And Discussion', 3).subscribe();
      const search = http.expectOne(r => r.url === `${base}/sessions/s1/paper/search`);
      expect(search.request.params.get('q')).toBe('CCCP');
      expect(search.request.params.get('section')).toBe('Results And Discussion');
      expect(search.request.params.get('limit')).toBe('3');
      service.qa('s1', 'r0', false).subscribe();
      const qa = http.expectOne(r => r.url === `${base}/sessions/s1/qa/r0`);
      expect(qa.request.params.get('llm')).toBe('false');
      service.accept('s1', 'p-001').subscribe();
      expect(http.expectOne(`${base}/sessions/s1/proposals/p-001/accept`).request.method).toBe('POST');
      service.reject('s1', 'p-002').subscribe();
      expect(http.expectOne(`${base}/sessions/s1/proposals/p-002/reject`).request.method).toBe('POST');
    });

    it('reads the token usage of a session', () => {
      let got: any;
      service.usage('s1').subscribe(r => got = r);
      const req = http.expectOne(`${base}/sessions/s1/usage`);
      expect(req.request.method).toBe('GET');
      req.flush({ source: 'run', entries: [], steps: [], totals: {}, spent_now: {} });
      expect(got.source).toBe('run');
    });

    it('reads evidence by instance dbId, including a negative one', () => {
      service.instanceEvidence('s1', -7).subscribe();
      http.expectOne(`${base}/sessions/s1/instances/-7/evidence`).flush([]);
    });
  });

  describe('authorisation', () => {
    it('refreshes the token once on a 401 and retries', () => {
      let got: any;
      service.sessions().subscribe(r => got = r);
      http.expectOne(`${base}/sessions`).flush({ detail: 'bad token' }, { status: 401, statusText: 'Unauthorized' });
      expect(tokenRefresh.refresh).toHaveBeenCalledTimes(1);
      http.expectOne(`${base}/sessions`).flush([]);
      expect(got).toEqual([]);
    });

    it('reports a second 401 as an error and does not refresh again', () => {
      let err: LlmApiError | undefined;
      service.sessions().subscribe({ error: e => err = e });
      http.expectOne(`${base}/sessions`).flush({ detail: 'x' }, { status: 401, statusText: 'Unauthorized' });
      http.expectOne(`${base}/sessions`).flush({ detail: 'auth service unreachable' }, { status: 401, statusText: 'Unauthorized' });
      expect(err instanceof LlmApiError && err.status === 401).toBeTrue();
      expect(err!.message).toBe('auth service unreachable');
      expect(tokenRefresh.refresh).toHaveBeenCalledTimes(1);
    });

    it('reports the original 401 when the refresh itself fails', () => {
      tokenRefresh.refresh.and.returnValue(throwError(() => new Error('refresh failed')));
      let err: LlmApiError | undefined;
      service.sessions().subscribe({ error: e => err = e });
      http.expectOne(`${base}/sessions`).flush({ detail: 'expired' }, { status: 401, statusText: 'Unauthorized' });
      expect(err!.status).toBe(401);
      http.expectNone(`${base}/sessions`);
    });
  });

  describe('errors', () => {
    const fail = (status: number, body: any): LlmApiError => {
      let err!: LlmApiError;
      service.sessions().subscribe({ error: e => err = e });
      http.expectOne(`${base}/sessions`).flush(body, { status, statusText: 'x' });
      return err;
    };

    it('explains an unreachable service', () => {
      let err!: LlmApiError;
      service.sessions().subscribe({ error: e => err = e });
      http.expectOne(`${base}/sessions`).error(new ProgressEvent('error'), { status: 0 });
      expect(err.status).toBe(0);
      expect(err.message).toContain('not reachable');
    });

    it('explains a non-curator', () => {
      const e = fail(403, { detail: "role 'viewer' may not use this feature" });
      expect(e.status).toBe(403);
      expect(e.message).toContain('viewer');
    });

    it('shows the server detail for validation and conflict errors, including FastAPI list details', () => {
      expect(fail(409, { detail: 'proposal is already accepted' }).message).toBe('proposal is already accepted');
      expect(fail(422, { detail: [{ msg: 'field required' }, { msg: 'bad pmid' }] }).message).toBe('field required; bad pmid');
      expect(fail(500, 'oops').message).toBe('The annotation service returned 500.');
    });
  });

  describe('pollJob', () => {
    const job = (status: Job['status']): Job => ({ id: 'j', status, progress: status, error: null });

    it('emits every state and completes after the final one', fakeAsync(() => {
      const seen: string[] = [];
      let completed = false;
      service.pollJob('j', 1000).subscribe({ next: j => seen.push(j.status), complete: () => completed = true });
      tick(0);
      http.expectOne(`${base}/jobs/j`).flush(job('running'));
      tick(1000);
      http.expectOne(`${base}/jobs/j`).flush(job('running'));
      tick(1000);
      http.expectOne(`${base}/jobs/j`).flush(job('done'));
      tick(5000);
      http.expectNone(`${base}/jobs/j`);
      expect(seen).toEqual(['running', 'running', 'done']);
      expect(completed).toBeTrue();
    }));

    it('also stops on a failed job', fakeAsync(() => {
      const seen: string[] = [];
      service.pollJob('j', 1000).subscribe(j => seen.push(j.status));
      tick(0);
      http.expectOne(`${base}/jobs/j`).flush({ ...job('failed'), error: 'no full text' });
      tick(3000);
      http.expectNone(`${base}/jobs/j`);
      expect(seen).toEqual(['failed']);
    }));
  });

  describe('streamChat', () => {
    const enc = new TextEncoder();
    const streamOf = (...chunks: string[]) => new ReadableStream<Uint8Array>({
      start(c) { chunks.forEach(x => c.enqueue(enc.encode(x))); c.close(); }
    });
    const ok = (...chunks: string[]) => new Response(streamOf(...chunks), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    let fetchSpy: jasmine.Spy;
    beforeEach(() => fetchSpy = spyOn(window, 'fetch'));

    it('posts the message and selection with the bearer token and yields parsed events across chunk boundaries', async () => {
      fetchSpy.and.resolveTo(ok('event: text\ndata: {"delta":"He', 'llo"}\n\nevent: proposal\ndata: {"id":"p-001"}\n\n',
        'event: done\ndata: {"proposalIds":["p-001"]}\n\n'));
      const events = await lastValueFrom(service.streamChat('s1', 'add CCCP', [-3, 12]).pipe(toArray()));
      expect(events.map(e => e.event)).toEqual(['text', 'proposal', 'done']);
      expect((events[0] as any).data.delta).toBe('Hello');
      const [url, init] = fetchSpy.calls.mostRecent().args;
      expect(url).toBe(`${base}/sessions/s1/chat`);
      expect(init.headers.Authorization).toBe('Bearer tok');
      expect(JSON.parse(init.body)).toEqual({ message: 'add CCCP', selectedDbIds: [-3, 12] });
    });

    it('delivers a final event that the server did not terminate with a blank line', async () => {
      fetchSpy.and.resolveTo(ok('event: done\ndata: {"proposalIds":[]}'));
      const events = await lastValueFrom(service.streamChat('s1', 'hi').pipe(toArray()));
      expect(events.map(e => e.event)).toEqual(['done']);
    });

    it('refreshes the token once on a 401 and retries with the new one', async () => {
      tokenRefresh.refresh.and.callFake(() => { localStorage.setItem('token', 'fresh-token'); return of('fresh-token'); });
      fetchSpy.and.returnValues(Promise.resolve(new Response('{}', { status: 401 })), Promise.resolve(ok('event: done\ndata: {"proposalIds":[]}\n\n')));
      const events = await lastValueFrom(service.streamChat('s1', 'hi').pipe(toArray()));
      expect(events.length).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.calls.mostRecent().args[1].headers.Authorization).toBe('Bearer fresh-token');
    });

    it('reports a rejected request with the server detail', async () => {
      fetchSpy.and.resolveTo(new Response(JSON.stringify({ detail: 'session is running; chat needs a ready session' }), { status: 409 }));
      const err = await firstValueFrom(service.streamChat('s1', 'hi').pipe(toArray())).catch(e => e);
      expect(err instanceof LlmApiError && err.status === 409).toBeTrue();
      expect(err.message).toContain('chat needs a ready session');
    });

    it('explains an unreachable service when fetch itself fails', async () => {
      fetchSpy.and.rejectWith(new TypeError('Failed to fetch'));
      const err = await firstValueFrom(service.streamChat('s1', 'hi').pipe(toArray())).catch(e => e);
      expect(err.status).toBe(0);
      expect(err.message).toContain('not reachable');
    });

    it('aborts the request when unsubscribed', async () => {
      let signal!: AbortSignal;
      fetchSpy.and.callFake((_url: string, init: RequestInit) => { signal = init.signal!; return new Promise(() => {}); });
      const sub = service.streamChat('s1', 'hi').subscribe();
      await Promise.resolve();
      sub.unsubscribe();
      expect(signal.aborted).toBeTrue();
    });
  });
});
