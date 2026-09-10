/**
 * The schema view: the class tree, the instance listing, and the class browser.
 *
 * This is the curator's main way into the data, so it is the flow most worth guarding.
 */

import { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { expectNoUnmatchedRequests } from '../fixtures/api-mock';

/** A node in the schema class tree, matched by class name. */
const treeNode = (page: Page, className: string) =>
  page.locator('mat-tree-node').filter({ hasText: new RegExp(`\\b${className}\\b`) }).first();

test.describe('the schema class tree', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schema_view/list_instances/Pathway');
    await expect(page.locator('app-schema-class-tree')).toBeVisible();
  });

  test('shows the class hierarchy rooted at DatabaseObject', async ({ page }) => {
    await expect(treeNode(page, 'DatabaseObject')).toBeVisible();
    await expect(treeNode(page, 'Event')).toBeVisible();
    await expect(treeNode(page, 'Pathway')).toBeVisible();
    await expect(treeNode(page, 'PhysicalEntity')).toBeVisible();
  });

  test('shows the instance count for each class', async ({ page }) => {
    // The count is how a curator judges whether a class is worth browsing.
    await expect(treeNode(page, 'Pathway')).toContainText('210');
    await expect(treeNode(page, 'Reaction')).toContainText('410');
    await expect(treeNode(page, 'DatabaseObject')).toContainText('1240');
  });

  test('expands the tree on first load, so the classes are reachable', async ({ page }) => {
    // A tree that opens collapsed makes every curator expand three levels to get anywhere.
    await expect(treeNode(page, 'SimpleEntity')).toBeVisible();
    await expect(treeNode(page, 'EntityWithAccessionedSequence')).toBeVisible();
  });

  test('offers a create button on a concrete class but not an abstract one', async ({ page }) => {
    // An abstract class cannot be instantiated, so offering the button would be a dead end.
    await expect(treeNode(page, 'Pathway').getByRole('button')).toBeVisible();
    await expect(treeNode(page, 'Event').getByText('add_box')).toHaveCount(0);
  });

  test('collapses a branch when its toggle is clicked', async ({ page }) => {
    await expect(treeNode(page, 'Pathway')).toBeVisible();

    await page.getByRole('button', { name: 'Toggle Event' }).click();

    await expect(treeNode(page, 'Pathway')).toBeHidden();
    await expect(treeNode(page, 'PhysicalEntity')).toBeVisible();
  });

  test('navigates to a class listing when a class is clicked', async ({ page }) => {
    await treeNode(page, 'Reaction').getByText('Reaction').click();

    await expect(page).toHaveURL(/list_instances\/Reaction/);
  });
});

test.describe('the instance listing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schema_view/list_instances/Pathway');
    await expect(page.locator('app-instance-list-table')).toBeVisible();
  });

  test('lists the instances of the routed class', async ({ page, api }) => {
    await expect(page.getByText('Glycolysis').first()).toBeVisible();
    expectNoUnmatchedRequests(api);
  });

  test('shows the dbId alongside the display name', async ({ page }) => {
    // The dbId is what a curator quotes in a bug report, so it has to be on screen.
    const row = page.locator('app-instance-list-table tr').filter({ hasText: 'Glycolysis' });
    await expect(row).toContainText('100');
  });

  test('titles the tab after the class being listed', async ({ page }) => {
    await expect(page).toHaveTitle(/Pathway/);
  });

  test('lists a different class when navigated to one', async ({ page }) => {
    await page.goto('/schema_view/list_instances/Reaction');

    await expect(page.getByText('Glucose + ATP').first()).toBeVisible();
  });

  test('offers the per-row actions a curator works through', async ({ page }) => {
    const row = page.locator('app-instance-list-table tr').filter({ hasText: 'Glycolysis' });

    await expect(row.getByText('launch')).toBeVisible();
    await expect(row.getByText('delete')).toBeVisible();
    await expect(row.getByText('list_alt')).toBeVisible();
  });

  test('opens the clicked instance', async ({ page }) => {
    await page.getByText('Glycolysis').first().click();

    await expect(page).toHaveURL(/\/schema_view\/instance\/100/);
  });

  test('searches within the class', async ({ page, api }) => {
    const search = page.locator('app-instance-list-view input[type="text"]').first();
    await search.fill('Glyco');
    await search.press('Enter');

    // Either endpoint is a legitimate implementation of the search box; what matters is that
    // typing a term sends a query rather than filtering only what is already on screen.
    await expect
      .poll(() => api.requestedPaths.some(p =>
        p.includes('searchInstances') || p.includes('findByDisplayName')))
      .toBeTruthy();
  });
});

test.describe('the class browser', () => {
  test('lists the attributes a class defines', async ({ page, api }) => {
    await page.goto('/schema_view/class/Pathway');

    await expect(page.getByText("Attributes of class 'Pathway'")).toBeVisible();
    await expect(page.getByText('hasEvent').first()).toBeVisible();
    await expect(page.getByText('doRelease').first()).toBeVisible();
    expectNoUnmatchedRequests(api);
  });

  test('sorts the attributes by name', async ({ page }) => {
    await page.goto('/schema_view/class/Pathway');
    await expect(page.getByText("Attributes of class 'Pathway'")).toBeVisible();

    const names = await page.locator('table tr td:first-child').allInnerTexts();
    const trimmed = names.map(n => n.trim()).filter(Boolean);

    expect(trimmed).toEqual([...trimmed].sort((a, b) => a.localeCompare(b)));
  });

  test('retitles the tab when browsing a different class', async ({ page }) => {
    // The router reuses this component between classes, so only its params subscription
    // re-fires; doing the retitle outside it left the title stuck on the first class.
    await page.goto('/schema_view/class/Pathway');
    await expect(page).toHaveTitle(/Pathway/);

    await page.goto('/schema_view/class/Reaction');

    await expect(page).toHaveTitle(/Reaction/);
    await expect(page.getByText("Attributes of class 'Reaction'")).toBeVisible();
  });
});
