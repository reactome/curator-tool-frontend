/**
 * Ask the Graph: a result holding dbIds is shown in the schema view's instance list, built
 * from the result rows themselves.
 */

import { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';

// The shape the query agent actually returns for "which reactions ...?": one row with a count
// and a sample collected as maps, under aliased keys.
const NL_RESPONSE = {
  answer: 'Two reactions have no catalyst.',
  queries: [{
    cypher: 'MATCH (r:ReactionLikeEvent) RETURN count(r) AS total, collect({stId:r.stId, dbId:r.dbId, name:r.displayName, cls:r.schemaClass})[..25] AS sample',
    params: {}, ok: true, row_count: 1,
  }],
  columns: ['total', 'sample'],
  rows: [{
    total: 2,
    sample: [
      { stId: 'R-HSA-101', dbId: 101, name: 'Glucose phosphorylation', cls: 'Reaction' },
      { stId: 'R-HSA-102', dbId: 102, name: 'Fructose cleavage', cls: 'Reaction' },
    ],
  }],
  rows_truncated: false,
  model: 'claude-opus-5-5',
};

/**
 * The NL endpoint is on another origin in development (localhost:8095), so it is answered
 * here, with CORS headers, rather than by the shared same-origin mock.
 */
async function mockNLQuery(page: Page, body: unknown): Promise<void> {
  await page.route('**/api/nlquery', async route => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function ask(page: Page, question: string): Promise<void> {
  await page.getByLabel('Ask the curation graph').fill(question);
  await page.getByLabel('Ask the curation graph').press('Enter');
}

test.describe('Ask the Graph results', () => {
  test.beforeEach(async ({ page }) => {
    await mockNLQuery(page, NL_RESPONSE);
    await page.goto('/graph_query');
  });

  test('lists the result rows in the instance list, with no search conditions', async ({ page, api }) => {
    await ask(page, 'Which reactions have no catalyst?');

    const list = page.locator('app-instance-list-view');
    await expect(list).toBeVisible();
    await expect(list.locator('.toolbar-title')).toHaveText('Reaction@Database');
    await expect(list.getByText('Glucose phosphorylation')).toBeVisible();
    await expect(list.getByText('Fructose cleavage')).toBeVisible();
    await expect(list.locator('search-filter')).toHaveCount(0);
    // Built from the rows: nothing is asked of the server to list them.
    expect(api.requestedPaths.filter(p => p.includes('listInstances') || p.includes('searchInstances'))).toEqual([]);
  });

  test('searches within the listed rows', async ({ page }) => {
    await ask(page, 'Which reactions have no catalyst?');
    const list = page.locator('app-instance-list-view');
    await expect(list.getByText('Glucose phosphorylation')).toBeVisible();

    await list.getByLabel('Search').fill('fructose');
    await list.getByLabel('Search').press('Enter');

    await expect(list.getByText('Fructose cleavage')).toBeVisible();
    await expect(list.getByText('Glucose phosphorylation')).toHaveCount(0);
  });
});
