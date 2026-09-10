# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: schema-view.spec.ts >> the schema class tree >> navigates to a class listing when a class is clicked
- Location: tests/schema-view.spec.ts:57:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /list_instances\/Reaction/
Received string:  "http://localhost:4200/schema_view/class/Reaction"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    23 × locator resolved to <html lang="en">…</html>
       - unexpected value "http://localhost:4200/schema_view/class/Reaction"

```

```yaml
- tree:
  - treeitem "Toggle DatabaseObject DatabaseObject [1240]" [expanded] [level=1]:
    - button "Toggle DatabaseObject"
    - link "DatabaseObject":
      - /url: /schema_view/class/DatabaseObject
    - link "[1240]":
      - /url: /schema_view/list_instances/DatabaseObject
  - treeitem "Toggle Event Event [620]" [expanded] [level=2]:
    - button "Toggle Event"
    - link "Event":
      - /url: /schema_view/class/Event
    - link "[620]":
      - /url: /schema_view/list_instances/Event
  - treeitem "Pathway [210]" [level=3]:
    - button [disabled]
    - link "Pathway":
      - /url: /schema_view/class/Pathway
    - link "[210]":
      - /url: /schema_view/list_instances/Pathway
    - button
  - treeitem "Reaction [410]" [level=3]:
    - button [disabled]
    - link "Reaction":
      - /url: /schema_view/class/Reaction
    - link "[410]":
      - /url: /schema_view/list_instances/Reaction
    - button
  - treeitem "Toggle PhysicalEntity PhysicalEntity [500]" [expanded] [level=2]:
    - button "Toggle PhysicalEntity"
    - link "PhysicalEntity":
      - /url: /schema_view/class/PhysicalEntity
    - link "[500]":
      - /url: /schema_view/list_instances/PhysicalEntity
  - treeitem "SimpleEntity [180]" [level=3]:
    - button [disabled]
    - link "SimpleEntity":
      - /url: /schema_view/class/SimpleEntity
    - link "[180]":
      - /url: /schema_view/list_instances/SimpleEntity
    - button
  - treeitem "Complex [120]" [level=3]:
    - button [disabled]
    - link "Complex":
      - /url: /schema_view/class/Complex
    - link "[120]":
      - /url: /schema_view/list_instances/Complex
    - button
  - treeitem "EntityWithAccessionedSequence [200]" [level=3]:
    - button [disabled]
    - link "EntityWithAccessionedSequence":
      - /url: /schema_view/class/EntityWithAccessionedSequence
    - link "[200]":
      - /url: /schema_view/list_instances/EntityWithAccessionedSequence
    - button
  - treeitem "ReferenceGeneProduct [90]" [level=2]:
    - button [disabled]
    - link "ReferenceGeneProduct":
      - /url: /schema_view/class/ReferenceGeneProduct
    - link "[90]":
      - /url: /schema_view/list_instances/ReferenceGeneProduct
    - button
  - treeitem "Person [30]" [level=2]:
    - button [disabled]
    - link "Person":
      - /url: /schema_view/class/Person
    - link "[30]":
      - /url: /schema_view/list_instances/Person
    - button
- heading "Attributes of class 'Reaction'" [level=2]
- table:
  - rowgroup:
    - row "Attribute Name Cardinality Value Type Category Attribute Origin Defining Type":
      - columnheader "Attribute Name":
        - button "Attribute Name"
      - columnheader "Cardinality":
        - button "Cardinality"
      - columnheader "Value Type":
        - button "Value Type"
      - columnheader "Category":
        - button "Category"
      - columnheader "Attribute Origin":
        - button "Attribute Origin"
      - columnheader "Defining Type":
        - button "Defining Type"
  - rowgroup:
    - row "catalystActivity + CatalystActivity Optional DatabaseObject None_defining":
      - cell "catalystActivity"
      - cell "+"
      - cell "CatalystActivity":
        - link "CatalystActivity":
          - /url: /schema_view/class/CatalystActivity
      - cell "Optional"
      - cell "DatabaseObject":
        - link "DatabaseObject":
          - /url: /schema_view/class/DatabaseObject
      - cell "None_defining"
    - row "definition 1 String Optional DatabaseObject None_defining":
      - cell "definition"
      - cell "1"
      - cell "String"
      - cell "Optional"
      - cell "DatabaseObject":
        - link "DatabaseObject":
          - /url: /schema_view/class/DatabaseObject
      - cell "None_defining"
    - row "input + PhysicalEntity Optional DatabaseObject None_defining":
      - cell "input"
      - cell "+"
      - cell "PhysicalEntity":
        - link "PhysicalEntity":
          - /url: /schema_view/class/PhysicalEntity
      - cell "Optional"
      - cell "DatabaseObject":
        - link "DatabaseObject":
          - /url: /schema_view/class/DatabaseObject
      - cell "None_defining"
    - row "name + String Required DatabaseObject None_defining":
      - cell "name"
      - cell "+"
      - cell "String"
      - cell "Required"
      - cell "DatabaseObject":
        - link "DatabaseObject":
          - /url: /schema_view/class/DatabaseObject
      - cell "None_defining"
    - row "output + PhysicalEntity Optional DatabaseObject None_defining":
      - cell "output"
      - cell "+"
      - cell "PhysicalEntity":
        - link "PhysicalEntity":
          - /url: /schema_view/class/PhysicalEntity
      - cell "Optional"
      - cell "DatabaseObject":
        - link "DatabaseObject":
          - /url: /schema_view/class/DatabaseObject
      - cell "None_defining"
    - row "reviewStatus 1 ReviewStatus Optional DatabaseObject None_defining":
      - cell "reviewStatus"
      - cell "1"
      - cell "ReviewStatus":
        - link "ReviewStatus":
          - /url: /schema_view/class/ReviewStatus
      - cell "Optional"
      - cell "DatabaseObject":
        - link "DatabaseObject":
          - /url: /schema_view/class/DatabaseObject
      - cell "None_defining"
    - row "species + Species Optional DatabaseObject None_defining":
      - cell "species"
      - cell "+"
      - cell "Species":
        - link "Species":
          - /url: /schema_view/class/Species
      - cell "Optional"
      - cell "DatabaseObject":
        - link "DatabaseObject":
          - /url: /schema_view/class/DatabaseObject
      - cell "None_defining"
- paragraph: "*The Sidebar on the left shows the hierarchy of Reactome classes."
- paragraph: The number of instances of this class is shown in square brackets and is hyperlinked to a page listing all instances in this class.
- paragraph: The main panel shows attributes of the selected class. Own attributes, i.e. the ones which are not inherited from a parent class are indicated in colour.
- paragraph: "'+' in 'Cardinality' column indicates that this is a multi-value attribute."
- text: "New instances:"
- button "0" [disabled]
- text: "Updated instances:"
- button "0" [disabled]
- text: "Deleted instances:"
- button "0" [disabled]
- text: "Pathway Diagram Locks:"
- button "0"
- text: "Default person:"
- button "Curator, Test [1]"
- button
- button
- button
- button
- button
- link "User guide":
  - /url: https://github.com/reactome/curator-tool-frontend/blob/main/docs/UserGuide.md
- button
- button
- button "BOOKMARKS"
- button
- text: No bookmarks to show
- button "Toggle help panel"
- text: Schema View Help
- button "Close help"
- heading "Class Tree (left)" [level=4]
- list:
  - listitem: Click a class name to view its attribute definitions.
  - listitem: Click the [count] badge to list instances from the database.
  - listitem: Click the (count) badge to list staged/local instances only.
  - listitem: Click the + icon to create a new instance of that class.
- heading "Instance List" [level=4]
- list:
  - listitem: Type in the search box and press Enter for a quick search.
  - listitem: Click the filter icon to switch to Advanced Search.
  - listitem: "Select rows to enable bulk actions: Delete Selected, Batch Edit, Compare."
  - listitem: Click the Download icon (after a search) to export results as CSV.
  - listitem: Use pagination controls at the bottom to navigate large lists.
- heading "Instance Editor" [level=4]
- list:
  - listitem: Click any row to open the instance in the editor.
  - listitem: Edit text fields directly — press Enter to commit, Ctrl+Enter for a new line.
  - listitem: Use the action menu on instance-type slots to set, add, replace, or delete values.
  - listitem: Drag a bookmark onto a compatible slot to set its value.
  - listitem: Click the QA icon to run quality checks on the instance.
  - listitem: Click the Upload icon to commit only this instance.
- heading "Batch Edit" [level=4]
- list:
  - listitem: Click the Batch Edit icon in the search bar to open the dialog.
  - listitem: Select an attribute and an action (Add, Replace, Delete) to apply across instances.
  - listitem: If rows are selected, batch edit targets only those; otherwise it applies to the full list scope.
- separator
- link "Open full Tutorial page":
  - /url: /tutorial
```

# Test source

```ts
  1   | /**
  2   |  * The schema view: the class tree, the instance listing, and the class browser.
  3   |  *
  4   |  * This is the curator's main way into the data, so it is the flow most worth guarding.
  5   |  */
  6   | 
  7   | import { Page } from '@playwright/test';
  8   | 
  9   | import { expect, test } from '../fixtures/test';
  10  | import { expectNoUnmatchedRequests } from '../fixtures/api-mock';
  11  | 
  12  | /** A node in the schema class tree, matched by class name. */
  13  | const treeNode = (page: Page, className: string) =>
  14  |   page.locator('mat-tree-node').filter({ hasText: new RegExp(`\\b${className}\\b`) }).first();
  15  | 
  16  | test.describe('the schema class tree', () => {
  17  |   test.beforeEach(async ({ page }) => {
  18  |     await page.goto('/schema_view/list_instances/Pathway');
  19  |     await expect(page.locator('app-schema-class-tree')).toBeVisible();
  20  |   });
  21  | 
  22  |   test('shows the class hierarchy rooted at DatabaseObject', async ({ page }) => {
  23  |     await expect(treeNode(page, 'DatabaseObject')).toBeVisible();
  24  |     await expect(treeNode(page, 'Event')).toBeVisible();
  25  |     await expect(treeNode(page, 'Pathway')).toBeVisible();
  26  |     await expect(treeNode(page, 'PhysicalEntity')).toBeVisible();
  27  |   });
  28  | 
  29  |   test('shows the instance count for each class', async ({ page }) => {
  30  |     // The count is how a curator judges whether a class is worth browsing.
  31  |     await expect(treeNode(page, 'Pathway')).toContainText('210');
  32  |     await expect(treeNode(page, 'Reaction')).toContainText('410');
  33  |     await expect(treeNode(page, 'DatabaseObject')).toContainText('1240');
  34  |   });
  35  | 
  36  |   test('expands the tree on first load, so the classes are reachable', async ({ page }) => {
  37  |     // A tree that opens collapsed makes every curator expand three levels to get anywhere.
  38  |     await expect(treeNode(page, 'SimpleEntity')).toBeVisible();
  39  |     await expect(treeNode(page, 'EntityWithAccessionedSequence')).toBeVisible();
  40  |   });
  41  | 
  42  |   test('offers a create button on a concrete class but not an abstract one', async ({ page }) => {
  43  |     // An abstract class cannot be instantiated, so offering the button would be a dead end.
  44  |     await expect(treeNode(page, 'Pathway').getByRole('button')).toBeVisible();
  45  |     await expect(treeNode(page, 'Event').getByText('add_box')).toHaveCount(0);
  46  |   });
  47  | 
  48  |   test('collapses a branch when its toggle is clicked', async ({ page }) => {
  49  |     await expect(treeNode(page, 'Pathway')).toBeVisible();
  50  | 
  51  |     await page.getByRole('button', { name: 'Toggle Event' }).click();
  52  | 
  53  |     await expect(treeNode(page, 'Pathway')).toBeHidden();
  54  |     await expect(treeNode(page, 'PhysicalEntity')).toBeVisible();
  55  |   });
  56  | 
  57  |   test('navigates to a class listing when a class is clicked', async ({ page }) => {
  58  |     await treeNode(page, 'Reaction').getByText('Reaction').click();
  59  | 
> 60  |     await expect(page).toHaveURL(/list_instances\/Reaction/);
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  61  |   });
  62  | });
  63  | 
  64  | test.describe('the instance listing', () => {
  65  |   test.beforeEach(async ({ page }) => {
  66  |     await page.goto('/schema_view/list_instances/Pathway');
  67  |     await expect(page.locator('app-instance-list-table')).toBeVisible();
  68  |   });
  69  | 
  70  |   test('lists the instances of the routed class', async ({ page, api }) => {
  71  |     await expect(page.getByText('Glycolysis').first()).toBeVisible();
  72  |     expectNoUnmatchedRequests(api);
  73  |   });
  74  | 
  75  |   test('shows the dbId alongside the display name', async ({ page }) => {
  76  |     // The dbId is what a curator quotes in a bug report, so it has to be on screen.
  77  |     const row = page.locator('app-instance-list-table tr').filter({ hasText: 'Glycolysis' });
  78  |     await expect(row).toContainText('100');
  79  |   });
  80  | 
  81  |   test('titles the tab after the class being listed', async ({ page }) => {
  82  |     await expect(page).toHaveTitle(/Pathway/);
  83  |   });
  84  | 
  85  |   test('lists a different class when navigated to one', async ({ page }) => {
  86  |     await page.goto('/schema_view/list_instances/Reaction');
  87  | 
  88  |     await expect(page.getByText('Glucose + ATP').first()).toBeVisible();
  89  |   });
  90  | 
  91  |   test('offers the per-row actions a curator works through', async ({ page }) => {
  92  |     const row = page.locator('app-instance-list-table tr').filter({ hasText: 'Glycolysis' });
  93  | 
  94  |     await expect(row.getByText('launch')).toBeVisible();
  95  |     await expect(row.getByText('delete')).toBeVisible();
  96  |     await expect(row.getByText('list_alt')).toBeVisible();
  97  |   });
  98  | 
  99  |   test('opens the clicked instance', async ({ page }) => {
  100 |     await page.getByText('Glycolysis').first().click();
  101 | 
  102 |     await expect(page).toHaveURL(/\/schema_view\/instance\/100/);
  103 |   });
  104 | 
  105 |   test('searches within the class', async ({ page, api }) => {
  106 |     const search = page.locator('app-instance-list-view input[type="text"]').first();
  107 |     await search.fill('Glyco');
  108 |     await search.press('Enter');
  109 | 
  110 |     // Either endpoint is a legitimate implementation of the search box; what matters is that
  111 |     // typing a term sends a query rather than filtering only what is already on screen.
  112 |     await expect
  113 |       .poll(() => api.requestedPaths.some(p =>
  114 |         p.includes('searchInstances') || p.includes('findByDisplayName')))
  115 |       .toBeTruthy();
  116 |   });
  117 | });
  118 | 
  119 | test.describe('the class browser', () => {
  120 |   test('lists the attributes a class defines', async ({ page, api }) => {
  121 |     await page.goto('/schema_view/class/Pathway');
  122 | 
  123 |     await expect(page.getByText("Attributes of class 'Pathway'")).toBeVisible();
  124 |     await expect(page.getByText('hasEvent').first()).toBeVisible();
  125 |     await expect(page.getByText('doRelease').first()).toBeVisible();
  126 |     expectNoUnmatchedRequests(api);
  127 |   });
  128 | 
  129 |   test('sorts the attributes by name', async ({ page }) => {
  130 |     await page.goto('/schema_view/class/Pathway');
  131 |     await expect(page.getByText("Attributes of class 'Pathway'")).toBeVisible();
  132 | 
  133 |     const names = await page.locator('table tr td:first-child').allInnerTexts();
  134 |     const trimmed = names.map(n => n.trim()).filter(Boolean);
  135 | 
  136 |     expect(trimmed).toEqual([...trimmed].sort((a, b) => a.localeCompare(b)));
  137 |   });
  138 | 
  139 |   test('retitles the tab when browsing a different class', async ({ page }) => {
  140 |     // The router reuses this component between classes, so only its params subscription
  141 |     // re-fires; doing the retitle outside it left the title stuck on the first class.
  142 |     await page.goto('/schema_view/class/Pathway');
  143 |     await expect(page).toHaveTitle(/Pathway/);
  144 | 
  145 |     await page.goto('/schema_view/class/Reaction');
  146 | 
  147 |     await expect(page).toHaveTitle(/Reaction/);
  148 |     await expect(page.getByText("Attributes of class 'Reaction'")).toBeVisible();
  149 |   });
  150 | });
  151 | 
```