/**
 * Compartments drawn inside another compartment must be on top of it, so that a curator can grab
 * the inner one without first moving the one around it out of the way. Cytoscape grabs the
 * topmost node under the pointer, so this checks which node its hit test finds.
 *
 * The compartment nodes the diagram library builds from the diagram JSON carry no reactomeId,
 * which is what this regressed on: the order fell back to the drawing, and that fallback treated
 * every compartment as layers of the same one.
 */

import { expect, test } from '../fixtures/test';
import { PATHWAY_DIAGRAM } from '../../src/testing/api-fixtures';

/** A two-layer compartment in the diagram JSON format. */
function compartment(id: number, reactomeId: number, displayName: string, x: number, y: number, width: number, height: number) {
  return {
    id, reactomeId, displayName,
    schemaClass: 'Compartment', renderableClass: 'Compartment',
    position: { x: x + width / 2, y: y + height / 2 },
    prop: { x, y, width, height },
    insets: { x: x + 10, y: y + 10, width: width - 20, height: height - 20 },
    textPosition: { x: x + 20, y: y + height - 20 },
    isDisease: false, isFadeOut: false
  };
}

test.describe('compartment stacking in the pathway diagram', () => {
  test.beforeEach(async ({ page, api }) => {
    // The surrounding compartment comes last, so drawing order alone would put it on top.
    api.override({
      name: 'nested compartments',
      match: p => p.includes('/fetchPathwayDiagramForPathway') || p.includes('/diagram'),
      body: {
        ...PATHWAY_DIAGRAM,
        compartments: [
          compartment(2, 7660, 'nucleoplasm', 300, 300, 300, 200),
          compartment(1, 70101, 'cytosol', 0, 0, 1200, 800)
        ]
      }
    });
    await page.goto('/event_view/instance/100');
    await expect(page.locator('app-pathway-diagram')).toBeAttached();
  });

  /** Runs fn against the live cytoscape instance once the compartments are stacked by the tree. */
  async function inDiagram<T>(page: any, fn: (cy: any) => T): Promise<T> {
    await expect.poll(() => page.evaluate(() => {
      const cy = (window as any).ng.getComponent(document.querySelector('app-pathway-diagram'))?.diagram?.cy;
      return cy?.getElementById('2-outer').data('z');
    })).toBe(30);
    return page.evaluate((source: string) => {
      const cy = (window as any).ng.getComponent(document.querySelector('app-pathway-diagram')).diagram.cy;
      return new Function('cy', `return (${source})(cy)`)(cy);
    }, fn.toString());
  }

  test('orders compartments by the compartment tree', async ({ page }) => {
    const z = await inDiagram(page, cy => cy.nodes('.Compartment')
      .map((node: any) => [node.id(), node.data('z'), Number(node.style('z-index'))]));

    // cytosol is at depth 2 and nucleoplasm at depth 3 of the fixture tree
    expect(z).toEqual([
      ['2-outer', 30, 30], ['2-inner', 35, 35], ['1-outer', 20, 20], ['1-inner', 25, 25]
    ]);
  });

  test('hits the inner compartment where it lies inside another', async ({ page }) => {
    const hit = await inDiagram(page, cy => {
      const center = cy.getElementById('2-inner').position();
      return cy.renderer().findNearestElements(center.x, center.y, true, false).map((ele: any) => ele.id());
    });

    expect(hit).toEqual(['2-inner']);
  });

  test('still hits the surrounding compartment outside the inner one', async ({ page }) => {
    const hit = await inDiagram(page, cy => {
      const box = cy.getElementById('1-inner').boundingBox();
      return cy.renderer().findNearestElements(box.x1 + 30, box.y1 + 30, true, false).map((ele: any) => ele.id());
    });

    expect(hit).toEqual(['1-inner']);
  });
});
