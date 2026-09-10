/**
 * The mock backend for the E2E suite.
 *
 * Every `/api/**` request the app makes is answered here from the fixtures in
 * `src/testing/api-fixtures.ts` -- the same file the Karma unit suite uses. Sharing it is the
 * point: if the two suites invented their own payloads they could drift until "all green"
 * stopped meaning the frontend agrees with one description of the server.
 *
 * Two deliberate properties:
 *
 * 1. **Nothing reaches the network.** A request that no fixture matches is failed, not passed
 *    through, and recorded on `unmatchedRequests`. A silent fall-through to a real localhost
 *    backend would make the suite pass or fail depending on whether one happens to be running.
 *
 * 2. **Writes are observable.** Commit/persist/delete are answered from fixtures *and*
 *    recorded on `recordedWrites`, so a test can assert what the frontend actually sent
 *    without a database to inspect afterwards.
 */

import { Page, Route, expect } from '@playwright/test';

import {
  DEFAULT_API_ROUTES,
  TEST_TOKEN,
  TEST_USER,
  type ApiRouteFixture
} from '../../src/testing/api-fixtures';

/** One request the app sent that no fixture claimed. */
export interface UnmatchedRequest {
  method: string;
  path: string;
}

/** One write the app sent, with its parsed body. */
export interface RecordedWrite {
  method: string;
  path: string;
  body: any;
}

export interface ApiMock {
  /** Requests no fixture matched. Assert this is empty to catch an endpoint added upstream. */
  unmatchedRequests: UnmatchedRequest[];
  /** Every non-GET request, in order, with its body parsed where it was JSON. */
  recordedWrites: RecordedWrite[];
  /** Writes whose path contains `fragment`. */
  writesTo(fragment: string): RecordedWrite[];
  /** Every request path seen, in order. Useful for asserting a view fetched what it needed. */
  requestedPaths: string[];
  /** Add a fixture ahead of the defaults, to override one route for a single test. */
  override(fixture: ApiRouteFixture): void;
  /** Fail the next request matching `fragment` with `status`, to test an error path. */
  failNext(fragment: string, status?: number): void;
}

/** Methods that change server state; recorded so a test can assert on what was sent. */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Installs the mock backend on `page`. Call it before the first navigation, so the app's
 * bootstrap requests are covered too.
 */
export async function installApiMock(page: Page): Promise<ApiMock> {
  const unmatchedRequests: UnmatchedRequest[] = [];
  const recordedWrites: RecordedWrite[] = [];
  const requestedPaths: string[] = [];
  const overrides: ApiRouteFixture[] = [];
  const oneShotFailures: { fragment: string, status: number }[] = [];

  const mock: ApiMock = {
    unmatchedRequests,
    recordedWrites,
    requestedPaths,
    writesTo: (fragment: string) =>
      recordedWrites.filter(write => write.path.includes(fragment)),
    override: (fixture: ApiRouteFixture) => overrides.unshift(fixture),
    failNext: (fragment: string, status = 500) =>
      oneShotFailures.push({ fragment, status })
  };

  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    requestedPaths.push(path);

    if (WRITE_METHODS.has(method)) {
      recordedWrites.push({ method, path, body: parseBody(request.postData()) });
    }

    // A queued one-shot failure wins, so an error path can be exercised without unpicking
    // the whole fixture list.
    const failureIndex = oneShotFailures.findIndex(f => path.includes(f.fragment));
    if (failureIndex > -1) {
      const [failure] = oneShotFailures.splice(failureIndex, 1);
      await route.fulfill({
        status: failure.status,
        contentType: 'application/json',
        body: JSON.stringify({ message: `Mocked ${failure.status} for ${path}` })
      });
      return;
    }

    const fixture = [...overrides, ...DEFAULT_API_ROUTES].find(f => f.match(path));
    if (!fixture) {
      unmatchedRequests.push({ method, path });
      // Abort rather than continue: falling through to a real backend would make this suite
      // pass or fail depending on whether one is running locally.
      await route.abort('failed');
      return;
    }

    const body = typeof fixture.body === 'function'
      ? (fixture.body as (p: string) => unknown)(path)
      : fixture.body;

    await route.fulfill({
      status: fixture.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(body ?? null)
    });
  });

  return mock;
}

function parseBody(raw: string | null): any {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Puts the browser into the state a just-logged-in tab is in: a token and username in
 * localStorage. Must run before the app bootstraps, because `authGuard` and the
 * `APP_INITIALIZER` both read the token during startup -- setting it after the first
 * navigation lands the tab on /login instead.
 */
export async function signIn(page: Page): Promise<void> {
  await page.addInitScript(([token, user]) => {
    localStorage.setItem('token', token as string);
    localStorage.setItem('login_username', user as string);
  }, [TEST_TOKEN, TEST_USER]);
}

/** Clears the session, so the next navigation is treated as an unauthenticated one. */
export async function signOut(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Asserts the app made no request the mock backend did not recognise.
 *
 * Worth calling at the end of a navigation-heavy test: an endpoint added to the app without a
 * fixture would otherwise surface as an unrelated, confusing UI failure somewhere downstream.
 */
export function expectNoUnmatchedRequests(mock: ApiMock): void {
  expect(mock.unmatchedRequests, 'the app called an endpoint with no fixture').toEqual([]);
}
