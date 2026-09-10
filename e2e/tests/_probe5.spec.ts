import { expect, test } from '../fixtures/test';

test('probe list view search + tree buttons', async ({ page, api }) => {
  await page.goto('/schema_view/list_instances/Pathway');
  await expect(page.locator('app-instance-list-table')).toBeVisible();

  console.log('pathway node buttons:', await page.locator('mat-tree-node')
    .filter({ hasText: /\bPathway\b/ }).first().getByRole('button').allInnerTexts());

  const inputs = await page.locator('app-instance-list-view input').evaluateAll(els =>
    els.map(e => ({
      type: (e as HTMLInputElement).type,
      placeholder: (e as HTMLInputElement).placeholder,
      aria: e.getAttribute('aria-label'),
      cls: e.className.slice(0, 60),
      parentTag: e.closest('mat-form-field') ? 'mat-form-field' : e.parentElement?.tagName
    })));
  console.log('list view inputs:', JSON.stringify(inputs, null, 1));

  console.log('toolbar text:', (await page.locator('app-instance-list-view mat-toolbar')
    .first().innerText()).slice(0, 300));

  const before = api.requestedPaths.length;
  const search = page.locator('app-instance-list-view input[type="text"]').first();
  await search.fill('Glyco');
  await search.press('Enter');
  await page.waitForTimeout(2000);
  console.log('new requests:', JSON.stringify(api.requestedPaths.slice(before)));
  expect(true).toBe(true);
});
