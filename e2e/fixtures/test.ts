/**
 * The `test` every spec in this suite imports.
 *
 * It extends Playwright's base test with two fixtures so a spec does not have to repeat the
 * setup, and -- more importantly -- so it cannot forget it: `installApiMock` has to run before
 * the first navigation, and `signIn` has to run before the app bootstraps.
 *
 *   import { test, expect } from '../fixtures/test';
 *
 *   test('...', async ({ page, api }) => { ... });          // signed in, backend mocked
 *   test('...', async ({ anonymousPage }) => { ... });      // no session
 */

import { test as base, expect } from '@playwright/test';

import { ApiMock, installApiMock, signIn } from './api-mock';

interface Fixtures {
  /** The mock backend, already installed on `page`. */
  api: ApiMock;
  /** A page with no session, for the login and route-guard specs. */
  anonymousPage: import('@playwright/test').Page;
}

export const test = base.extend<Fixtures>({
  // `auto: true` is load-bearing, not tidiness. Playwright only instantiates a fixture a test
  // actually destructures, so as an ordinary fixture this ran for `({ page, api })` tests and
  // was silently skipped for `({ page })` ones -- which then had no mock backend and no
  // session, and every one of them ended up redirected to /login. Making it automatic means a
  // spec cannot forget the setup by leaving `api` out of its signature.
  api: [async ({ page }, use) => {
    const mock = await installApiMock(page);
    await signIn(page);
    await use(mock);
  }, { auto: true }],

  anonymousPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installApiMock(page);
    await use(page);
    await context.close();
  }
});

export { expect };
