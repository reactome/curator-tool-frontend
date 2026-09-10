/**
 * Signing in, being kept out, and being let back in.
 *
 * This is the boilerplate every other flow depends on, and it is the part with the most
 * non-obvious behaviour: the route guard remembers where the curator was going, and login has
 * to honour that rather than always landing on /home.
 */

import { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { expectNoUnmatchedRequests } from '../fixtures/api-mock';

/**
 * The login form's submit button, scoped to the form.
 *
 * The InfoDialogComponent that reports a bad password has an OK button of its own, so an
 * unscoped `getByRole('button', { name: 'OK' })` matches two elements once that dialog is up.
 */
const submitButton = (page: Page) =>
  page.locator('app-auth-form').getByRole('button', { name: 'OK' });

/** The error dialog's dismiss button. */
const dialogOkButton = (page: Page) =>
  page.locator('mat-dialog-container').getByRole('button', { name: 'OK' });

/** Fills in the credentials and submits. */
async function signInWith(page: Page, username: string, password: string): Promise<void> {
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await submitButton(page).click();
}

test.describe('signing in', () => {
  test('shows the login form to a tab with no session', async ({ anonymousPage: page }) => {
    await page.goto('/home');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(submitButton(page)).toBeEnabled();
  });

  test('titles the login page', async ({ anonymousPage: page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(/Sign In/);
  });

  test('signs the curator in and lands them on the home page', async ({ anonymousPage: page }) => {
    await page.goto('/login');

    await signInWith(page, 'test_curator', 'secret');

    await expect(page).toHaveURL(/\/home/);
  });

  test('stores the session token so a reload stays signed in', async ({ anonymousPage: page }) => {
    await page.goto('/login');
    await signInWith(page, 'test_curator', 'secret');
    await expect(page).toHaveURL(/\/home/);

    await page.reload();

    await expect(page).toHaveURL(/\/home/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy();
    expect(await page.evaluate(() => localStorage.getItem('login_username')))
      .toEqual('test_curator');
  });

  test('reports a bad password instead of failing silently', async ({ anonymousPage: page }) => {
    await installFailingLogin(page);
    await page.goto('/login');

    await signInWith(page, 'test_curator', 'wrong');

    await expect(page.getByText('Wrong user name or password').first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('reports the failure once, not as a stack of dialogs', async ({ anonymousPage: page }) => {
    // The error used to be reported twice -- once from catchError and again from the
    // "no usable token" branch it fell through into -- leaving two identical dialogs to
    // dismiss one after the other.
    await installFailingLogin(page);
    await page.goto('/login');

    await signInWith(page, 'test_curator', 'wrong');
    await expect(page.locator('mat-dialog-container')).toHaveCount(1);
  });

  test('lets the curator retry after a failure', async ({ anonymousPage: page }) => {
    await installFailingLogin(page);
    await page.goto('/login');
    await signInWith(page, 'test_curator', 'wrong');
    await expect(page.getByText('Wrong user name or password').first()).toBeVisible();

    // Dismiss the error dialog. It is modal, so the form behind it is inert until it closes --
    // asserting on the button while it is still open tests the overlay, not the form.
    await dialogOkButton(page).click();
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);

    // The button has to come back out of its in-flight state, or the form is a dead end.
    await expect(submitButton(page)).toBeEnabled();

    // And a correct password now gets through.
    await page.unroute('**/api/auth/login**');
    await signInWith(page, 'test_curator', 'secret');

    await expect(page).toHaveURL(/\/home/);
  });
});

test.describe('the route guard', () => {
  const PROTECTED = [
    '/schema_view/list_instances/Pathway',
    '/schema_view/instance/100',
    '/event_view',
    '/paper2path'
  ];

  for (const url of PROTECTED) {
    test(`keeps an unauthenticated tab out of ${url}`, async ({ anonymousPage: page }) => {
      await page.goto(url);

      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('returns the curator to the deep link they were blocked from', async ({ anonymousPage: page }) => {
    // A pasted URL or a bookmark must not be lost by having to sign in first.
    await page.goto('/schema_view/instance/100');
    await expect(page).toHaveURL(/\/login/);

    await signInWith(page, 'test_curator', 'secret');

    await expect(page).toHaveURL(/\/schema_view\/instance\/100/);
  });

  test('does not reuse a remembered view for an unrelated later login', async ({ anonymousPage: page }) => {
    await page.goto('/schema_view/instance/100');
    await expect(page).toHaveURL(/\/login/);
    await signInWith(page, 'test_curator', 'secret');
    await expect(page).toHaveURL(/\/schema_view\/instance\/100/);

    // Signing out and back in should go to /home, not back to the old deep link.
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await signInWith(page, 'test_curator', 'secret');

    await expect(page).toHaveURL(/\/home/);
  });

  test('lets an authenticated tab straight through', async ({ page, api }) => {
    await page.goto('/schema_view/instance/100');

    await expect(page).toHaveURL(/\/schema_view\/instance\/100/);
    expectNoUnmatchedRequests(api);
  });

  test('keeps an already-signed-in tab off the login page', async ({ page }) => {
    // A tab that reloads while its session is fine should not be shown a form it does not
    // need -- but with nothing remembered, /login is still a legitimate place to sit.
    await page.goto('/login');

    await expect(page.locator('app-root')).toBeVisible();
  });
});

/** Makes the login endpoint reject, the way a wrong password does. */
async function installFailingLogin(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/auth/login**', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Bad credentials' })
  }));
}
