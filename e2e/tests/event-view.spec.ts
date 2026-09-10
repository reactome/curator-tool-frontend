/**
 * The event view: the event tree, the pathway diagram, and the instance panel beside them.
 *
 * The diagram itself is a cytoscape canvas, so these tests check that it mounts and that the
 * surrounding wiring works, rather than trying to assert on rendered graph geometry -- the
 * diagram's own graph operations are covered by diagram-editor.service.spec.ts.
 */

import { expect, test } from '../fixtures/test';
import { expectNoUnmatchedRequests } from '../fixtures/api-mock';

test.describe('the event view', () => {
  test('loads with its event tree', async ({ page, api }) => {
    await page.goto('/event_view');

    await expect(page.getByText('Reactome WebBench: Event View')).toBeVisible();
    expectNoUnmatchedRequests(api);
  });

  test('fetches the event hierarchy for a species', async ({ page, api }) => {
    await page.goto('/event_view');
    await expect(page.getByText('Reactome WebBench: Event View')).toBeVisible();

    await expect.poll(() => api.requestedPaths.some(p => p.includes('getEventTree')))
      .toBeTruthy();
  });

  test('shows the pathways of the event hierarchy', async ({ page }) => {
    await page.goto('/event_view');

    await expect(page.getByText('Glycolysis').first()).toBeVisible();
  });

  test('opens a pathway from a deep link', async ({ page, api }) => {
    await page.goto('/event_view/instance/100');

    // The instance panel loads the pathway alongside the diagram.
    await expect(page.getByText('Pathway: Glycolysis [100]')).toBeVisible();
    expectNoUnmatchedRequests(api);
  });

  test('shows the pathway attributes in the instance panel', async ({ page }) => {
    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();

    const row = page.locator('app-instance-table tbody tr')
      .filter({ hasText: 'hasEvent' }).first();
    await expect(row).toContainText('Glucose + ATP');
  });

  test('mounts the diagram component for a pathway that has one', async ({ page }) => {
    await page.goto('/event_view/instance/100');

    await expect(page.locator('app-pathway-diagram')).toBeAttached();
  });

  test('asks the server for the diagram of the routed pathway', async ({ page, api }) => {
    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-pathway-diagram')).toBeAttached();

    await expect.poll(() => api.requestedPaths.some(p =>
      p.includes('fetchPathwayDiagramForPathway') || p.includes('/diagram'))).toBeTruthy();
  });

  test('checks whether the diagram is locked by someone else', async ({ page, api }) => {
    // A diagram locked by another curator has to open read-only, so this check has to happen
    // before any editing is offered.
    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-pathway-diagram')).toBeAttached();

    await expect.poll(() => api.requestedPaths.some(p =>
      p.includes('hasDiagramLocked') || p.includes('getDiagramLocks'))).toBeTruthy();
  });

  test('titles the tab after the pathway, not the static index title', async ({ page }) => {
    // Without this every event-view tab carries an identical title and they cannot be told
    // apart in the browser's tab strip.
    await page.goto('/event_view/instance/100');

    await expect(page).toHaveTitle(/Glycolysis/);
  });

  test('opens a reaction rather than failing when routed to one', async ({ page, api }) => {
    await page.goto('/event_view/instance/101');

    await expect(page.getByText(/Reaction: Glucose \+ ATP/).first()).toBeVisible();
    expectNoUnmatchedRequests(api);
  });

  test('does not throw during load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
