/**
 * Editing hasEvent while the event tree is on screen.
 *
 * The tree is not re-fetched after an edit: EventTreeComponent listens on the edit bus and
 * rebuilds its data source in place (handleHasEventEdit). These tests drive that through the
 * real UI, because the unit specs push onto the bus directly and so cannot catch a break in
 * everything between the attribute table and that subscription.
 */

import { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { INSTANCES, trailingId } from '../../src/testing/api-fixtures';

/** The row for one attribute in the instance panel. */
const rowContaining = (page: Page, attribute: string) =>
  page.locator('app-instance-table tbody tr').filter({ hasText: attribute }).first();

/** The event tree node whose label contains the given text. */
const treeNode = (page: Page, text: string) =>
  page.locator('app-event-tree mat-tree-node').filter({ hasText: text });

/** Opens the value action menu on a hasEvent value, which only appears on hover. */
async function openValueMenu(page: Page, valueText: string) {
  const link = rowContaining(page, 'hasEvent')
    .locator('a.value-link').filter({ hasText: valueText }).first();
  await link.hover();
  const fab = rowContaining(page, 'hasEvent').locator('button.row-action-fab').first();
  await fab.click();
}

test.describe('editing hasEvent in the event view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
    // The tree opens with the top-level pathway collapsed.
    await treeNode(page, 'Glycolysis').locator('button[mattreenodetoggle]').first().click();
    await expect(treeNode(page, 'Glucose + ATP')).toBeVisible();
  });

  test('drops an event removed from hasEvent out of the tree', async ({ page }) => {
    await openValueMenu(page, 'Glucose + ATP');
    await page.getByRole('button', { name: /Delete/ }).first().click();

    await expect(rowContaining(page, 'hasEvent')).not.toContainText('Glucose + ATP');
    await expect(treeNode(page, 'Glucose + ATP')).toHaveCount(0);
  });

  test('shows an event added to hasEvent in the tree', async ({ page }) => {
    await openValueMenu(page, 'Glucose + ATP');
    await page.getByRole('button', { name: /Add via Creation/ }).first().click();
    await expect(page.locator('mat-dialog-container')).toBeVisible();

    await page.locator('mat-dialog-container mat-select').click();
    await page.getByRole('option', { name: 'Reaction' }).click();
    await page.locator('mat-dialog-container').getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);

    // The new reaction has no name yet, so it is listed as "To be generated".
    await expect(rowContaining(page, 'hasEvent')).toContainText('To be generated');
    await expect(treeNode(page, 'To be generated')).toHaveCount(1);
  });

  test('does not throw while applying the edit', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await openValueMenu(page, 'Glucose + ATP');
    await page.getByRole('button', { name: /Delete/ }).first().click();
    await expect(rowContaining(page, 'hasEvent')).not.toContainText('Glucose + ATP');

    expect(errors).toEqual([]);
  });
});

/**
 * The same edit, but on a sub-pathway reached by clicking it in the tree rather than on the
 * routed top-level pathway. This is how a curator actually works: the instance the panel shows
 * is then loaded through the event view's own selection path, not from the route.
 */
test.describe('editing hasEvent on a sub-pathway selected in the tree', () => {
  /** A Pathway nested under Glycolysis, with one reaction of its own. */
  const SUB_PATHWAY = {
    dbId: 150,
    displayName: 'Glucose metabolism',
    schemaClassName: 'Pathway',
    attributes: {
      speciesName: 'Homo sapiens',
      doRelease: true,
      hasEvent: [
        {
          dbId: 102,
          displayName: 'Glucose-6-phosphate => Fructose-6-phosphate',
          schemaClassName: 'Reaction',
          attributes: { speciesName: 'Homo sapiens', doRelease: true, hasEvent: [] }
        }
      ]
    }
  };

  const NESTED_EVENT_TREE = [
    {
      dbId: 100,
      displayName: 'Glycolysis',
      schemaClassName: 'Pathway',
      attributes: {
        hasDiagram: true,
        speciesName: 'Homo sapiens',
        doRelease: true,
        hasEvent: [
          {
            dbId: 101,
            displayName: 'Glucose + ATP => Glucose-6-phosphate + ADP',
            schemaClassName: 'Reaction',
            attributes: { speciesName: 'Homo sapiens', doRelease: true, hasEvent: [] }
          },
          SUB_PATHWAY
        ]
      }
    }
  ];

  /** The sub-pathway as /findByDbId returns it: instance-valued slots hold shells. */
  const SUB_PATHWAY_INSTANCE = {
    dbId: 150,
    displayName: 'Glucose metabolism',
    schemaClassName: 'Pathway',
    attributes: {
      name: ['Glucose metabolism'],
      hasEvent: [
        {
          dbId: 102,
          displayName: 'Glucose-6-phosphate => Fructose-6-phosphate',
          schemaClassName: 'Reaction'
        }
      ],
      doRelease: true
    }
  };

  test.beforeEach(async ({ page, api }) => {
    api.override({
      name: 'nested event tree',
      match: p => p.includes('/getEventTree'),
      body: { events: NESTED_EVENT_TREE, cycles: [] }
    });
    api.override({
      name: 'sub-pathway instance',
      match: p => p.includes('/findByDbId'),
      body: p => (trailingId(p) === 150 ? SUB_PATHWAY_INSTANCE : INSTANCES[trailingId(p)] ?? null)
    });

    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
    await treeNode(page, 'Glycolysis').locator('button[mattreenodetoggle]').first().click();
    await expect(treeNode(page, 'Glucose metabolism')).toBeVisible();

    // Select the sub-pathway in the tree, which is what loads it into the instance panel.
    await treeNode(page, 'Glucose metabolism').getByRole('button', { name: 'Glucose metabolism' })
      .click();
    await expect(page.getByText('Pathway: Glucose metabolism [150]')).toBeVisible();
    await treeNode(page, 'Glucose metabolism').locator('button[mattreenodetoggle]').first().click();
  });

  test('shows an event added to the sub-pathway in the tree', async ({ page }) => {
    await openValueMenu(page, 'Glucose-6-phosphate => Fructose-6-phosphate');
    await page.getByRole('button', { name: /Add via Creation/ }).first().click();
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await page.locator('mat-dialog-container mat-select').click();
    await page.getByRole('option', { name: 'Reaction' }).click();
    await page.locator('mat-dialog-container').getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);

    await expect(rowContaining(page, 'hasEvent')).toContainText('To be generated');
    await expect(treeNode(page, 'To be generated')).toHaveCount(1);
  });

  test('drops an event removed from the sub-pathway out of the tree', async ({ page }) => {
    await openValueMenu(page, 'Glucose-6-phosphate => Fructose-6-phosphate');
    await page.getByRole('button', { name: /Delete/ }).first().click();

    await expect(rowContaining(page, 'hasEvent'))
      .not.toContainText('Glucose-6-phosphate => Fructose-6-phosphate');
    // Only the copy under the sub-pathway goes; the tree keeps any other parent's copy.
    await expect(treeNode(page, 'Glucose-6-phosphate => Fructose-6-phosphate')).toHaveCount(0);
  });
});

/**
 * Adding an event that already exists in the database, through the selection dialog. This is a
 * different code path from creating one (InstanceTableComponent.addInstanceViaSelect), and it is
 * how an existing reaction gets moved or shared into another pathway.
 */
test.describe('adding an existing event to hasEvent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
    await treeNode(page, 'Glycolysis').locator('button[mattreenodetoggle]').first().click();
    await expect(treeNode(page, 'Glucose + ATP')).toBeVisible();
  });

  test('shows the selected event in the tree', async ({ page }) => {
    // Remove reaction 102 first, so adding it back through the dialog is a real change.
    await openValueMenu(page, 'Glucose-6-phosphate => Fructose-6-phosphate');
    await page.getByRole('button', { name: /Delete/ }).first().click();
    await expect(treeNode(page, 'Glucose-6-phosphate => Fructose-6-phosphate')).toHaveCount(0);

    await openValueMenu(page, 'Glucose + ATP');
    await page.getByRole('button', { name: /Add via Selection/ }).first().click();
    await expect(page.locator('mat-dialog-container')).toBeVisible();

    await page.getByRole('combobox', { name: 'Event' }).click();
    await page.getByRole('option', { name: 'Reaction', exact: true }).click();
    await page.locator('mat-dialog-container')
      .getByText('Glucose-6-phosphate => Fructose-6-phosphate').first().click();
    await page.locator('mat-dialog-container').getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);

    await expect(rowContaining(page, 'hasEvent'))
      .toContainText('Glucose-6-phosphate => Fructose-6-phosphate');
    await expect(treeNode(page, 'Glucose-6-phosphate => Fructose-6-phosphate')).toHaveCount(1);
  });
});

/**
 * A hasEvent edit that puts a pathway inside something it already contains. The backend drops a
 * committed cycle before returning the hierarchy, and mergeLocalChangesToEventTree drops one this
 * session's staged edits created, so the tree can always be flattened. An edit applied while the
 * tree is on screen goes through neither.
 */
test.describe('an edit that creates a circular reference', () => {
  const SUB_PATHWAY = {
    dbId: 150,
    displayName: 'Glucose metabolism',
    schemaClassName: 'Pathway',
    attributes: {
      speciesName: 'Homo sapiens',
      doRelease: true,
      hasEvent: [
        {
          dbId: 102,
          displayName: 'Glucose-6-phosphate => Fructose-6-phosphate',
          schemaClassName: 'Reaction',
          attributes: { speciesName: 'Homo sapiens', doRelease: true, hasEvent: [] }
        }
      ]
    }
  };

  const NESTED_EVENT_TREE = [
    {
      dbId: 100,
      displayName: 'Glycolysis',
      schemaClassName: 'Pathway',
      attributes: {
        hasDiagram: true,
        speciesName: 'Homo sapiens',
        doRelease: true,
        hasEvent: [SUB_PATHWAY]
      }
    }
  ];

  const SUB_PATHWAY_INSTANCE = {
    dbId: 150,
    displayName: 'Glucose metabolism',
    schemaClassName: 'Pathway',
    attributes: {
      name: ['Glucose metabolism'],
      hasEvent: [
        {
          dbId: 102,
          displayName: 'Glucose-6-phosphate => Fructose-6-phosphate',
          schemaClassName: 'Reaction'
        }
      ],
      doRelease: true
    }
  };

  test('reports it instead of hanging the event view', async ({ page, api }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const consoleErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    api.override({
      name: 'nested event tree',
      match: p => p.includes('/getEventTree'),
      body: { events: NESTED_EVENT_TREE, cycles: [] }
    });
    api.override({
      name: 'sub-pathway instance',
      match: p => p.includes('/findByDbId'),
      body: p => (trailingId(p) === 150 ? SUB_PATHWAY_INSTANCE : INSTANCES[trailingId(p)] ?? null)
    });

    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-instance-table')).toBeVisible();
    await treeNode(page, 'Glycolysis').locator('button[mattreenodetoggle]').first().click();
    await treeNode(page, 'Glucose metabolism').getByRole('button', { name: 'Glucose metabolism' })
      .click();
    await expect(page.getByText('Pathway: Glucose metabolism [150]')).toBeVisible();

    // Put Glycolysis, which contains this pathway, into this pathway's hasEvent.
    await openValueMenu(page, 'Glucose-6-phosphate => Fructose-6-phosphate');
    await page.getByRole('button', { name: /Add via Selection/ }).first().click();
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await page.getByRole('combobox', { name: 'Event' }).click();
    await page.getByRole('option', { name: 'Pathway', exact: true }).click();
    await page.locator('mat-dialog-container').getByText('Glycolysis').first().click();
    await page.locator('mat-dialog-container').getByRole('button', { name: 'OK' }).click();

    // The edit stands - it is not refused any more.
    await expect(rowContaining(page, 'hasEvent')).toContainText('Glycolysis [100]');

    // What the curator gets told, rather than a tree that quietly stopped updating.
    await expect(page.locator('mat-dialog-container'))
      .toContainText('Circular Reference in the Event Hierarchy');
    await expect(page.locator('mat-dialog-container'))
      .toContainText('Glycolysis [100] > Glucose metabolism [150] > Glycolysis [100]');
    await page.keyboard.press('Escape');

    // Flattening a cyclic hasEvent recurses until the stack runs out, which is reported by
    // Angular's error handler rather than as a page error - so the console is what catches it.
    expect(consoleErrors.filter(e => e.includes('Maximum call stack size exceeded'))).toEqual([]);
    expect(errors).toEqual([]);

    // The hierarchy is intact apart from the relationship it cannot show, which is how the
    // curator navigates to the event they have to fix.
    await treeNode(page, 'Glucose metabolism').locator('button[mattreenodetoggle]').first().click();
    expect(await page.locator('app-event-tree mat-tree-node').allInnerTexts())
      .toEqual(expectedTreeAfterTheEdit());
  });

  /** The tree the curator should still be looking at: the cycle left out, nothing else lost. */
  function expectedTreeAfterTheEdit(): string[] {
    return [
      '',
      'expand_more\ncenter_focus_strong\nnew_label\nGlycolysis',
      'expand_more\ncenter_focus_strong\nnew_label\nschema\nGlucose metabolism',
      'center_focus_strong\nnew_label\nGlucose-6-phosphate => Fructose-6-phosphate'
    ];
  }
});
