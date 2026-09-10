# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: schema-view.spec.ts >> the instance listing >> searches within the class
- Location: tests/schema-view.spec.ts:105:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('app-instance-list-view input[type="text"]').first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - tree [ref=e10]:
        - treeitem [expanded] [level=1] [ref=e11]:
          - button "Toggle DatabaseObject" [ref=e12] [cursor=pointer]:
            - img [aria-hidden] [ref=e13]: expand_more
          - link "DatabaseObject" [ref=e16] [cursor=pointer]:
            - /url: /schema_view/class/DatabaseObject
          - link "[1240]" [ref=e17] [cursor=pointer]:
            - /url: /schema_view/list_instances/DatabaseObject
        - treeitem [expanded] [level=2] [ref=e18]:
          - button "Toggle Event" [ref=e19] [cursor=pointer]:
            - img [aria-hidden] [ref=e20]: expand_more
          - link "Event" [ref=e23] [cursor=pointer]:
            - /url: /schema_view/class/Event
          - link "[620]" [ref=e24] [cursor=pointer]:
            - /url: /schema_view/list_instances/Event
        - treeitem [level=3] [ref=e25]:
          - button [disabled]
          - link "Pathway" [ref=e26] [cursor=pointer]:
            - /url: /schema_view/class/Pathway
          - link "[210]" [ref=e27] [cursor=pointer]:
            - /url: /schema_view/list_instances/Pathway
          - button [ref=e28] [cursor=pointer]:
            - img [aria-hidden] [ref=e29]: add_box
        - treeitem [level=3] [ref=e30]:
          - button [disabled]
          - link "Reaction" [ref=e31] [cursor=pointer]:
            - /url: /schema_view/class/Reaction
          - link "[410]" [ref=e32] [cursor=pointer]:
            - /url: /schema_view/list_instances/Reaction
          - button [ref=e33] [cursor=pointer]:
            - img [aria-hidden] [ref=e34]: add_box
        - treeitem [expanded] [level=2] [ref=e35]:
          - button "Toggle PhysicalEntity" [ref=e36] [cursor=pointer]:
            - img [aria-hidden] [ref=e37]: expand_more
          - link "PhysicalEntity" [ref=e40] [cursor=pointer]:
            - /url: /schema_view/class/PhysicalEntity
          - link "[500]" [ref=e41] [cursor=pointer]:
            - /url: /schema_view/list_instances/PhysicalEntity
        - treeitem [level=3] [ref=e42]:
          - button [disabled]
          - link "SimpleEntity" [ref=e43] [cursor=pointer]:
            - /url: /schema_view/class/SimpleEntity
          - link "[180]" [ref=e44] [cursor=pointer]:
            - /url: /schema_view/list_instances/SimpleEntity
          - button [ref=e45] [cursor=pointer]:
            - img [aria-hidden] [ref=e46]: add_box
        - treeitem [level=3] [ref=e47]:
          - button [disabled]
          - link "Complex" [ref=e48] [cursor=pointer]:
            - /url: /schema_view/class/Complex
          - link "[120]" [ref=e49] [cursor=pointer]:
            - /url: /schema_view/list_instances/Complex
          - button [ref=e50] [cursor=pointer]:
            - img [aria-hidden] [ref=e51]: add_box
        - treeitem [level=3] [ref=e52]:
          - button [disabled]
          - link "EntityWithAccessionedSequence" [ref=e53] [cursor=pointer]:
            - /url: /schema_view/class/EntityWithAccessionedSequence
          - link "[200]" [ref=e54] [cursor=pointer]:
            - /url: /schema_view/list_instances/EntityWithAccessionedSequence
          - button [ref=e55] [cursor=pointer]:
            - img [aria-hidden] [ref=e56]: add_box
        - treeitem [level=2] [ref=e57]:
          - button [disabled]
          - link "ReferenceGeneProduct" [ref=e58] [cursor=pointer]:
            - /url: /schema_view/class/ReferenceGeneProduct
          - link "[90]" [ref=e59] [cursor=pointer]:
            - /url: /schema_view/list_instances/ReferenceGeneProduct
          - button [ref=e60] [cursor=pointer]:
            - img [aria-hidden] [ref=e61]: add_box
        - treeitem [level=2] [ref=e62]:
          - button [disabled]
          - link "Person" [ref=e63] [cursor=pointer]:
            - /url: /schema_view/class/Person
          - link "[30]" [ref=e64] [cursor=pointer]:
            - /url: /schema_view/list_instances/Person
          - button [ref=e65] [cursor=pointer]:
            - img [aria-hidden] [ref=e66]: add_box
      - generic [ref=e71]:
        - generic [ref=e72]:
          - generic [ref=e73]: Pathway@Database
          - generic [ref=e74]:
            - generic [ref=e75]: Species
            - group "Species quick filter" [ref=e76]:
              - button "All" [pressed] [ref=e78] [cursor=pointer]
              - button "Human" [ref=e82] [cursor=pointer]
              - button "Non-human" [ref=e85] [cursor=pointer]
        - generic [ref=e89]:
          - generic [ref=e90]:
            - generic [ref=e91]: Search
            - textbox "Search" [ref=e92]
          - img [aria-hidden] [ref=e94] [cursor=pointer]: manage_search
        - generic [ref=e96]:
          - table [ref=e98]:
            - rowgroup [ref=e99]:
              - row [ref=e100]:
                - columnheader "dbId" [ref=e101]
                - columnheader "Display Name" [ref=e102]
                - columnheader [ref=e103]
            - rowgroup [ref=e104]:
              - row [ref=e105]:
                - cell [ref=e106]:
                  - text: I
                  - link "100" [ref=e107] [cursor=pointer]:
                    - /url: /
                - cell [ref=e108]:
                  - link "Glycolysis" [ref=e110] [cursor=pointer]:
                    - /url: /
                - cell [ref=e111]:
                  - generic [ref=e112]:
                    - button [ref=e113] [cursor=pointer]:
                      - img [aria-hidden] [ref=e114]: check_box_outline_blank
                    - button [ref=e117] [cursor=pointer]:
                      - img [aria-hidden] [ref=e118]: launch
                    - button [ref=e121] [cursor=pointer]:
                      - img [aria-hidden] [ref=e122]: delete
                    - button [ref=e125] [cursor=pointer]:
                      - img [aria-hidden] [ref=e126]: list_alt
                    - button [ref=e129] [cursor=pointer]:
                      - img [aria-hidden] [ref=e130]: bookmark
                    - button [ref=e133] [cursor=pointer]:
                      - img [aria-hidden] [ref=e134]: more_horiz
          - generic [ref=e137]:
            - generic [ref=e138]:
              - text: "Selected Instances: 0"
              - img [aria-hidden] [ref=e139] [cursor=pointer]: check_box_outline
              - img [aria-hidden] [ref=e140] [cursor=pointer]: deselect_all
              - img [aria-hidden] [ref=e141] [cursor=pointer]: delete
            - group "Select page of users" [ref=e142]:
              - generic [ref=e144]:
                - generic [ref=e145]:
                  - generic [ref=e146]: "Items per page:"
                  - combobox "20 Items per page:" [ref=e151] [cursor=pointer]:
                    - generic [ref=e152]: "20"
                - generic [ref=e159]:
                  - generic [ref=e160]: 1 – 1 of 1
                  - button "First page" [disabled]
                  - button "Previous page" [disabled]
                  - button "Next page" [disabled]
                  - button "Last page" [disabled]
    - generic [ref=e161]:
      - generic [ref=e162]:
        - generic [ref=e163]:
          - text: "New instances:"
          - button "0" [disabled]
        - generic [ref=e164]:
          - text: "Updated instances:"
          - button "0" [disabled]
        - generic [ref=e165]:
          - text: "Deleted instances:"
          - button "0" [disabled]
        - generic [ref=e166]:
          - text: "Pathway Diagram Locks:"
          - button "0" [ref=e167]
        - generic [ref=e171]:
          - text: "Default person:"
          - button "Curator, Test [1]" [ref=e172]
      - generic [ref=e176]:
        - button [ref=e177] [cursor=pointer]:
          - img [aria-hidden] [ref=e178]: timeline
        - button [ref=e181] [cursor=pointer]:
          - img [aria-hidden] [ref=e182]: home
        - button [ref=e185] [cursor=pointer]:
          - img [aria-hidden] [ref=e186]: restore
        - button [ref=e189] [cursor=pointer]:
          - img [aria-hidden] [ref=e190]: file_download
        - button [ref=e193] [cursor=pointer]:
          - img [aria-hidden] [ref=e194]: file_upload
        - link "User guide" [ref=e197] [cursor=pointer]:
          - /url: https://github.com/reactome/curator-tool-frontend/blob/main/docs/UserGuide.md
          - img [aria-hidden] [ref=e198]: menu_book
        - button [ref=e201] [cursor=pointer]:
          - img [aria-hidden] [ref=e202]: bug_report
        - button [ref=e205] [cursor=pointer]:
          - img [aria-hidden] [ref=e206]: logout
    - generic [ref=e209]:
      - button "BOOKMARKS" [ref=e210] [cursor=pointer]
      - generic [ref=e212]:
        - button [ref=e214] [cursor=pointer]:
          - img [aria-hidden] [ref=e215]: file_upload
        - generic [ref=e218]: No bookmarks to show
  - generic:
    - button "Toggle help panel":
      - img [aria-hidden]: help_outline
    - generic [ref=e219]:
      - generic [ref=e220]:
        - img [aria-hidden] [ref=e221]: help_outline
        - generic [ref=e222]: Schema View Help
        - button "Close help" [ref=e223] [cursor=pointer]:
          - img [aria-hidden] [ref=e224]: close
      - generic [ref=e227]:
        - heading "Class Tree (left)" [level=4] [ref=e228]
        - list [ref=e229]:
          - listitem [ref=e230]: Click a class name to view its attribute definitions.
          - listitem [ref=e231]: Click the [count] badge to list instances from the database.
          - listitem [ref=e232]: Click the (count) badge to list staged/local instances only.
          - listitem [ref=e233]: Click the + icon to create a new instance of that class.
        - heading "Instance List" [level=4] [ref=e234]
        - list [ref=e235]:
          - listitem [ref=e236]: Type in the search box and press Enter for a quick search.
          - listitem [ref=e237]: Click the filter icon to switch to Advanced Search.
          - listitem [ref=e238]: "Select rows to enable bulk actions: Delete Selected, Batch Edit, Compare."
          - listitem [ref=e239]: Click the Download icon (after a search) to export results as CSV.
          - listitem [ref=e240]: Use pagination controls at the bottom to navigate large lists.
        - heading "Instance Editor" [level=4] [ref=e241]
        - list [ref=e242]:
          - listitem [ref=e243]: Click any row to open the instance in the editor.
          - listitem [ref=e244]: Edit text fields directly — press Enter to commit, Ctrl+Enter for a new line.
          - listitem [ref=e245]: Use the action menu on instance-type slots to set, add, replace, or delete values.
          - listitem [ref=e246]: Drag a bookmark onto a compatible slot to set its value.
          - listitem [ref=e247]: Click the QA icon to run quality checks on the instance.
          - listitem [ref=e248]: Click the Upload icon to commit only this instance.
        - heading "Batch Edit" [level=4] [ref=e249]
        - list [ref=e250]:
          - listitem [ref=e251]: Click the Batch Edit icon in the search bar to open the dialog.
          - listitem [ref=e252]: Select an attribute and an action (Add, Replace, Delete) to apply across instances.
          - listitem [ref=e253]: If rows are selected, batch edit targets only those; otherwise it applies to the full list scope.
        - separator [ref=e254]
        - link "Open full Tutorial page" [ref=e255] [cursor=pointer]:
          - /url: /tutorial
          - img [aria-hidden] [ref=e256]: school
          - text: Open full Tutorial page
```

# Test source

```ts
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
  60  |     await expect(page).toHaveURL(/list_instances\/Reaction/);
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
> 107 |     await search.fill('Glyco');
      |                  ^ Error: locator.fill: Test timeout of 30000ms exceeded.
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