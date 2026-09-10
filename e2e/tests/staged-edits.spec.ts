/**
 * Creating an instance, editing one, and getting the result committed.
 *
 * This is where the app does something irreversible, so it is the flow most worth covering end
 * to end. Two things learned from the app's actual behaviour shape these tests:
 *
 * - An edit is staged *locally* (localStorage, via the ngrx effects) and is not pushed to the
 *   server until an explicit commit, a five-minute idle auto-persist, or page unload. So there
 *   is no request to wait for straight after typing.
 * - Commit and compare are disabled until the instance actually has changes, which is why every
 *   commit test here has to make an edit first.
 *
 * The mock backend records every write, so the commit assertions check what the frontend
 * actually sent -- there is no database to inspect afterwards.
 */

import { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';

/** The row for one attribute in the instance table. */
const rowContaining = (page: Page, attribute: string) =>
  page.locator('app-instance-table tbody tr').filter({ hasText: attribute }).first();

/** An instance-level action button, matched by its Material icon name. */
const actionButton = (page: Page, icon: string) =>
  page.locator('app-instance-view button').filter({ hasText: new RegExp(`^${icon}$`) }).first();

/** The tree's create button for a class. */
const createButton = (page: Page, className: string) =>
  page.locator('mat-tree-node').filter({ hasText: new RegExp(`\\b${className}\\b`) })
    .first().getByText('add_box');

/** Edits an attribute in place and commits the field. */
async function editAttribute(page: Page, attribute: string, value: string): Promise<void> {
  const field = rowContaining(page, attribute).locator('input, textarea').first();
  await field.fill(value);
  await field.press('Enter');
}

/** localStorage keys the ngrx effects write staged edits under. */
const stagedKeys = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('_instance_actions')));

test.describe('creating an instance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schema_view/list_instances/Pathway');
    await expect(page.locator('app-schema-class-tree')).toBeVisible();
  });

  test('creates a new instance of the class chosen in the tree', async ({ page }) => {
    await createButton(page, 'Pathway').click();

    // A new instance gets a negative dbId until it is committed.
    await expect(page).toHaveURL(/\/schema_view\/instance\/-\d+/);
  });

  test('opens the new instance with an editable attribute table', async ({ page }) => {
    await createButton(page, 'Pathway').click();
    await expect(page.locator('app-instance-table')).toBeVisible();

    await expect(rowContaining(page, 'name')).toBeVisible();
    await expect(rowContaining(page, 'hasEvent')).toBeVisible();
  });

  test('stages the new instance, so it survives navigating away and back', async ({ page }) => {
    await createButton(page, 'Pathway').click();
    await expect(page).toHaveURL(/instance\/-\d+/);
    const newInstanceUrl = page.url();

    await page.goto('/schema_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
    await page.goto(newInstanceUrl);

    await expect(page.locator('app-instance-table')).toBeVisible();
    await expect(rowContaining(page, 'name')).toBeVisible();
  });

  test('records the new instance in the staged-edit store', async ({ page }) => {
    await createButton(page, 'Pathway').click();
    await expect(page).toHaveURL(/instance\/-\d+/);

    await expect.poll(() => stagedKeys(page))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('register_new_instance')
      ]) as unknown as string[]);
  });

  test('offers a commit action on a brand new instance', async ({ page }) => {
    // A new instance is by definition changed, so it is committable straight away -- unlike
    // an untouched database instance.
    await createButton(page, 'Pathway').click();
    await expect(page.locator('app-instance-table')).toBeVisible();

    await expect(actionButton(page, 'upload')).toBeEnabled();
  });
});

test.describe('editing an instance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schema_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
  });

  test('keeps the edited value on screen', async ({ page }) => {
    // A re-fetch that clobbers the just-typed value is the classic regression here.
    await editAttribute(page, 'definition', 'An edited definition.');

    await expect(rowContaining(page, 'definition').locator('input, textarea').first())
      .toHaveValue('An edited definition.');
  });

  test('stages the edit locally rather than sending it immediately', async ({ page, api }) => {
    // Editing must not chatter to the server on every keystroke; the staged edits are pushed
    // on commit, on idle, or on unload.
    await editAttribute(page, 'definition', 'An edited definition.');

    await expect.poll(() => stagedKeys(page))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('register_updated_instance')
      ]) as unknown as string[]);
    expect(api.writesTo('/commit')).toEqual([]);
  });

  test('records the edited value, not the original', async ({ page }) => {
    await editAttribute(page, 'definition', 'An edited definition.');
    await expect.poll(() => stagedKeys(page)).not.toEqual([]);

    const staged = await page.evaluate(() => Object.entries(localStorage)
      .filter(([k]) => k.includes('_instance_actions'))
      .map(([, v]) => v).join('|'));

    expect(staged).toContain('An edited definition.');
  });

  test('enables commit once the instance has changes', async ({ page }) => {
    // Committing an untouched instance would create a pointless InstanceEdit, so the button
    // stays disabled until there is something to send.
    await expect(actionButton(page, 'upload')).toBeDisabled();

    await editAttribute(page, 'definition', 'An edited definition.');

    await expect(actionButton(page, 'upload')).toBeEnabled();
  });

  test('enables the database comparison once the instance has changes', async ({ page }) => {
    await expect(actionButton(page, 'compare')).toBeDisabled();

    await editAttribute(page, 'definition', 'An edited definition.');

    await expect(actionButton(page, 'compare')).toBeEnabled();
  });

  test('survives a reload, so a crash does not lose the work', async ({ page }) => {
    await editAttribute(page, 'definition', 'An edited definition.');
    await expect.poll(() => stagedKeys(page)).not.toEqual([]);

    await page.reload();
    await expect(page.locator('app-instance-table')).toBeVisible();

    await expect(actionButton(page, 'upload')).toBeEnabled();
  });
});

test.describe('committing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schema_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
    await editAttribute(page, 'definition', 'An edited definition.');
    await expect(actionButton(page, 'upload')).toBeEnabled();
  });

  test('sends the instance to the commit endpoint', async ({ page, api }) => {
    await actionButton(page, 'upload').click();

    await expect.poll(() => api.writesTo('/commit').length,
      { timeout: 15_000 }).toBeGreaterThan(0);
  });

  test('commits the instance the curator was looking at', async ({ page, api }) => {
    await actionButton(page, 'upload').click();
    await expect.poll(() => api.writesTo('/commit').length,
      { timeout: 15_000 }).toBeGreaterThan(0);

    expect(api.writesTo('/commit')[0].body?.dbId).toEqual(100);
  });

  test('sends the edited value in the commit payload', async ({ page, api }) => {
    await actionButton(page, 'upload').click();
    await expect.poll(() => api.writesTo('/commit').length,
      { timeout: 15_000 }).toBeGreaterThan(0);

    expect(JSON.stringify(api.writesTo('/commit')[0].body))
      .toContain('An edited definition.');
  });

  test('reports a rejected commit instead of appearing to succeed', async ({ page, api }) => {
    // Silently swallowing a failed commit is the worst outcome here: the curator believes
    // their work is saved when it is not.
    api.failNext('/commit', 500);

    await actionButton(page, 'upload').click();

    await expect(page.locator('mat-dialog-container, .mat-mdc-snack-bar-container').first())
      .toBeVisible({ timeout: 15_000 });
  });
});

test.describe('deleting an instance', () => {
  test('asks for confirmation rather than deleting on the first click', async ({ page, api }) => {
    await page.goto('/schema_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();

    await actionButton(page, 'delete').click();

    await expect(page.locator('mat-dialog-container')).toBeVisible();
    // Nothing may be sent before the curator confirms.
    expect(api.writesTo('/delete')).toEqual([]);
  });

  test('shows the referrers of the instance being deleted', async ({ page }) => {
    // Deleting something other instances point at is what a curator needs warning about.
    await page.goto('/schema_view/instance/101');
    await expect(page.locator('app-instance-table')).toBeVisible();

    await actionButton(page, 'delete').click();

    await expect(page.locator('mat-dialog-container')).toBeVisible();
  });

  test('deletes nothing when the dialog is dismissed', async ({ page, api }) => {
    await page.goto('/schema_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
    await actionButton(page, 'delete').click();
    await expect(page.locator('mat-dialog-container')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('mat-dialog-container')).toHaveCount(0);
    expect(api.writesTo('/delete')).toEqual([]);
  });
});
