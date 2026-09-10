/**
 * The suite's own smoke test: does the app boot against the mock backend at all?
 *
 * If this fails, nothing else in the suite means anything, so it is worth keeping separate
 * and reading first.
 */

import { expect, test } from '../fixtures/test';
import { expectNoUnmatchedRequests } from '../fixtures/api-mock';

test.describe('application shell', () => {
  test('boots and lands on the home page when signed in', async ({ page, api }) => {
    await page.goto('/home');

    await expect(page).toHaveURL(/\/home/);
    // The shell renders its router outlet plus the status bar; something has to be on screen.
    await expect(page.locator('app-root')).toBeVisible();
    expectNoUnmatchedRequests(api);
  });

  test('serves every request from the mock backend, never the network', async ({ page, api }) => {
    await page.goto('/home');
    await expect(page.locator('app-root')).toBeVisible();

    // Any /api call that got through to a real server would be a hole in the isolation this
    // suite depends on.
    expect(api.unmatchedRequests).toEqual([]);
  });

  test('reports a browser console error, so a boot failure is not silent', async ({ page, api }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/home');
    await expect(page.locator('app-root')).toBeVisible();

    expect(errors, 'the app threw during bootstrap').toEqual([]);
    expectNoUnmatchedRequests(api);
  });
});
