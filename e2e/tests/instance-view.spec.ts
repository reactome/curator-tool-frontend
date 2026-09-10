/**
 * The instance view: the attribute table a curator spends most of their day in.
 */

import { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { expectNoUnmatchedRequests } from '../fixtures/api-mock';

/** The table row for one attribute, matched by the attribute name in its first cell. */
const attributeRow = (page: Page, attribute: string) =>
  page.locator('app-instance-table tbody tr')
    .filter({ has: page.locator(`td:first-child:text-is("${attribute}")`) });

/** Any row mentioning the attribute, for slots whose cell markup varies. */
const rowContaining = (page: Page, attribute: string) =>
  page.locator('app-instance-table tbody tr').filter({ hasText: attribute }).first();

test.describe('the instance view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schema_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
  });

  test('titles itself with the class, display name, and dbId', async ({ page, api }) => {
    // The dbId in the heading is what a curator quotes when reporting a problem.
    await expect(page.getByText('Pathway: Glycolysis [100]')).toBeVisible();
    expectNoUnmatchedRequests(api);
  });

  test('titles the browser tab, so tabs are distinguishable', async ({ page }) => {
    await expect(page).toHaveTitle(/Glycolysis/);
  });

  test('lists the attributes the class defines', async ({ page }) => {
    for (const attribute of ['name', 'definition', 'hasEvent', 'species', 'doRelease']) {
      await expect(rowContaining(page, attribute)).toBeVisible();
    }
  });

  test('shows a row even for an attribute with no value', async ({ page }) => {
    // A curator fills empty slots in; hiding them would make them unreachable.
    await expect(rowContaining(page, 'summation')).toBeVisible();
    await expect(rowContaining(page, 'literatureReference')).toBeVisible();
  });

  test('renders an instance-valued slot as its referenced instances', async ({ page }) => {
    const row = rowContaining(page, 'hasEvent');

    await expect(row).toContainText('Glucose + ATP => Glucose-6-phosphate + ADP');
    await expect(row).toContainText('101');
  });

  test('renders every value of a multi-valued instance slot', async ({ page }) => {
    const row = rowContaining(page, 'hasEvent');

    await expect(row).toContainText('101');
    await expect(row).toContainText('102');
  });

  test('renders a scalar value in an editable field', async ({ page }) => {
    // Scalars live in inputs rather than as text, which is what makes them editable in place.
    const row = rowContaining(page, 'definition');

    await expect(row.locator('input, textarea').first())
      .toHaveValue(/The conversion of glucose/);
  });

  test('shows both values of a multi-valued scalar slot', async ({ page }) => {
    const values = await rowContaining(page, 'name')
      .locator('input, textarea').evaluateAll(els =>
        els.map(e => (e as HTMLInputElement).value));

    expect(values).toContain('Glycolysis');
    expect(values).toContain('glycolytic pathway');
  });

  test('offers the instance-level actions a curator works through', async ({ page }) => {
    for (const action of ['list_alt', 'compare', 'delete', 'upload']) {
      await expect(page.getByText(action, { exact: true }).first()).toBeVisible();
    }
  });

  test('navigates to a referenced instance and back again', async ({ page }) => {
    // Following a reference and returning is the single most common navigation in the app.
    await page.getByText('Glucose + ATP => Glucose-6-phosphate + ADP').first().click();

    await expect(page).toHaveURL(/\/schema_view\/instance\/101/);
    await expect(page.getByText(/Reaction: Glucose \+ ATP/).first()).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/\/schema_view\/instance\/100/);
    await expect(page.getByText('Pathway: Glycolysis [100]')).toBeVisible();
  });

  test('shows the attributes of the newly loaded instance after navigating', async ({ page }) => {
    // The table has to rebuild from the new class, not keep the previous one's rows.
    await page.goto('/schema_view/instance/101');
    await expect(page.locator('app-instance-table')).toBeVisible();

    await expect(rowContaining(page, 'input')).toBeVisible();
    await expect(rowContaining(page, 'output')).toBeVisible();
    await expect(rowContaining(page, 'hasEvent')).toHaveCount(0);
  });

  test('loads an instance of a different class from a deep link', async ({ page, api }) => {
    await page.goto('/schema_view/instance/201');
    await expect(page.locator('app-instance-table')).toBeVisible();

    await expect(page.getByText(/SimpleEntity: glucose \[201\]/)).toBeVisible();
    expectNoUnmatchedRequests(api);
  });
});

test.describe('the referrers view', () => {
  test('lists what points at an instance, grouped by attribute', async ({ page, api }) => {
    await page.goto('/schema_view/referrers/101');

    await expect(page.getByText('Referrals')).toBeVisible();
    // The attribute the reference travels through matters as much as the referrer itself.
    await expect(page.getByText('hasEvent').first()).toBeVisible();
    await expect(page.getByText('Glycolysis').first()).toBeVisible();
    expectNoUnmatchedRequests(api);
  });

  test('groups a referrer list that spans several attributes', async ({ page }) => {
    // dbId 202 is referenced as the output of one reaction and the input of another.
    await page.goto('/schema_view/referrers/202');
    await expect(page.getByText('Referrals')).toBeVisible();

    await expect(page.getByText('output').first()).toBeVisible();
    await expect(page.getByText('input').first()).toBeVisible();
  });

  test('reports an instance nothing refers to without erroring', async ({ page }) => {
    await page.goto('/schema_view/referrers/100');

    await expect(page.getByText('Referrals')).toBeVisible();
  });
});

test.describe('the QA report', () => {
  test('opens from the instance view and shows the failed checks', async ({ page }) => {
    await page.goto('/schema_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();

    await page.getByText('checklist', { exact: true }).first().click();

    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();
    // The fixture reports one passing and one failing check.
    await expect(dialog).toContainText('Missing species');
  });

  test('shows the offending rows of a failed check', async ({ page }) => {
    await page.goto('/schema_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
    await page.getByText('checklist', { exact: true }).first().click();

    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toContainText('species is empty');
  });
});
