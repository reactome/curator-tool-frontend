/**
 * Gene2Path: the pathway search (curator-tool-llm, POST /api/llm/pathways/by-gene, then the job), and the papers under it.
 *
 * curator-tool-llm is outside the fixtures of the mock backend, so each test serves it here. Its being down must not
 * send the curator to /login: Gene2Path used to call a Flask service, and a refused connection to that (status 0) was
 * taken for a lost session.
 */

import { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';

const PATHWAYS = {
  gene: 'PINK1', status: 'ok', confident: true,
  annotated_pathways: [{ pathway_id: 5205647, pathway_name: 'Mitophagy' },
                       { pathway_id: 1632852, pathway_name: 'Macroautophagy' }],
  predicted_pathways: [
    { pathway_id: 9013419, pathway_name: 'Miro GTPase Cycle', fdr: 6.2e-4, overlap_count: 2, mapped_genes: ['RHOT1', 'RHOT2'], annotated: false },
    { pathway_id: 5205647, pathway_name: 'Mitophagy', fdr: 4.9e-3, overlap_count: 2, mapped_genes: ['SQSTM1', 'ULK1'], annotated: true },
  ],
  partners: [{ gene: 'PRKN', score: 0.99 }, { gene: 'RHOT1', score: 0.97 }, { gene: 'SQSTM1', score: 0.95 }],
  params: { fi_cutoff: 0.8, top_partners: 10, fdr_cutoff: 0.05, max_pathways: 8 },
};
const PAPERS = {
  gene: 'PINK1', accession: 'Q9BXM7', pool_size: 120, candidate_pool: 50, dropped_below_threshold: 0,
  papers: [{ pmid: '24751536', title: 'PINK1 phosphorylates ubiquitin to activate Parkin E3 ubiquitin ligase activity',
             journal: 'J Cell Biol', year: '2014', pmcid: 'PMC4003245', score: 9, evidence_type: 'DIRECT',
             annotatable: true, justification: 'Shows the phosphorylation directly.' }],
};
const done = (id: string, result: unknown) => ({ id, status: 'done', progress: 'done', error: null, result });

async function run(page: Page, gene = 'PINK1') {
  await page.goto('/gene2path');
  await page.getByLabel('Gene symbol').fill(gene);
  await page.getByLabel('Gene symbol').press('Enter');
}

test('lists the annotated and predicted pathways, then the papers', async ({ page }) => {
  let sent: any;
  await page.route('**/api/llm/pathways/by-gene', route => { sent = route.request().postDataJSON(); route.fulfill({ json: { jobId: 'p1' } }); });
  await page.route('**/api/llm/jobs/p1', route => route.fulfill({ json: done('p1', PATHWAYS) }));
  await page.route('**/api/llm/papers/by-gene', route => route.fulfill({ json: { jobId: 'g1' } }));
  await page.route('**/api/llm/jobs/g1', route => route.fulfill({ json: done('g1', PAPERS) }));

  await run(page, 'pink1');

  await expect(page.locator('#annotated_pathways li')).toHaveText(['Mitophagy', 'Macroautophagy']);
  const rows = page.locator('#predicted_pathways tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Miro GTPase Cycle');
  await expect(rows.nth(0)).toContainText('6.2E-4');
  await expect(rows.nth(1)).toContainText('already annotated');
  await expect(page.locator('#predicted_pathways')).toContainText('1 of them is not annotated for PINK1 yet');
  await expect(page.locator('#relevant_papers .candidate')).toContainText('PINK1 phosphorylates ubiquitin');
  expect(sent).toEqual({ gene: 'PINK1', fi_cutoff: 0.8, top_partners: 10, fdr_cutoff: 0.05, max_pathways: 8 });
  if (process.env['G2P_SHOT']) await page.screenshot({ path: process.env['G2P_SHOT'], fullPage: false });
});

test('says the service is unreachable, rather than sending the curator to the login page', async ({ page }) => {
  await page.route('**/api/llm/**', route => route.abort('connectionrefused'));

  await run(page);

  await expect(page.locator('.failure')).toContainText('not reachable');
  await expect(page).toHaveURL(/\/gene2path/);
});

test('asks for a login before running, since the service needs one', async ({ anonymousPage: page }) => {
  await page.goto('/gene2path');

  await expect(page.locator('.login')).toContainText('needs a WebBench login');
  await expect(page.getByRole('button', { name: 'Run' })).toBeDisabled();
});
