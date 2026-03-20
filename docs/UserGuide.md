# Reactome Curation WebBench User Guide

This guide explains how to use the Curator Tool frontend for daily curation tasks.

## Quick links

- [Jump to Attribute Editing Quick Reference](#attribute-editing-quick-reference)
- [Jump to Schema View](#5-schema-view)
- [Jump to Event View](#6-event-view)
- [Jump to Gene2Path App](#7-gene2path-app)
- [Jump to Common Workflows](#8-common-workflows)

## 1) What this site includes

After login, the home page gives access to three major areas:

- **Schema View**: browse schema classes, list instances, open/edit instances, and manage staged changes.
- **Event View**: work with pathway/event trees, diagrams, and instance editing together.
- **Gene2Path App**: submit a gene and review LLM-generated pathway annotation support.

## 2) Sign in and session basics

### Sign in

1. Open the site login page.
2. Enter **Username** and **Password**.
3. Click **OK**.

If authentication fails, you will see an error dialog indicating wrong credentials.

### Protected pages

The following areas require login:

- `/home`
- `/schema_view`
- `/event_view`

`/gene2path` is currently available without the route guard.

### Session behavior

- If you are redirected to login from a protected URL, successful login returns you to that saved URL.
- On browser close/reload, staged user instances are persisted.
- Clicking **Log out** persists current user-instance state and returns to login.

## 3) Home page

The home page is your launcher:

- **Schema View** card
- **Event View** card
- **Gene2Path App** card

A bottom status toolbar is also shown here (without staged-instance counters).

## 4) Global status toolbar

Most work pages display the status toolbar at the bottom.

### What it shows

- **New instances** count
- **Updated instances** count
- **Deleted instances** count
- **Default person** (current selected Person instance, if any)

### Main actions

- Click a staged-count button to open the staged-changes panel.
- Click **Default person** to select/change default Person.
- **Home** icon: go to home page.
- **Bug report** icon: opens the bug report document.
- **Log out** icon: save state and log out.

### Staged-change warning

If too many instances are staged, a warning appears asking you to commit changes as soon as possible.

## 5) Schema View

Schema View is the main curation workspace.

Layout:

- **Left panel**: schema class tree (or staged-changes panel when toggled).
- **Main panel**: routed content (class table, instance list, or instance editor).
- **Bookmark panel**: draggable/collapsible **BOOKMARKS** strip on the right.
- **Bottom**: global status toolbar.

### 5.1 Schema class tree (left)

For each class, you can use:

- Class name link → class attribute table (`/schema_view/class/{ClassName}`)
- `[count]` link → database list (`/schema_view/list_instances/{ClassName}`)
- `(localCount)` link (if present) → staged/local list (`/schema_view/local_list_instances/{ClassName}`)
- **Add** icon → create a new instance of that class

### 5.2 Class attributes page

The class table displays:

- Attribute name
- Value type
- Category
- Allowed classes
- Origin class
- Cardinality
- Defining type

Useful behavior:

- Instance-type attributes link to their allowed class page.
- Origin links to the class defining that attribute.
- Rows are sortable.

### 5.3 List Instances page

The list header indicates source:

- `@Database` for DB-backed list
- `@Staged` for local/staged list

#### Search modes

- **Simple search**: type in search box, press Enter.
- **Advanced search**: click manage-search icon to switch modes, then build conditions in the filter panel.
- In advanced mode, you can undo the last added condition.

#### Download search results

- After running a search on an `@Database` list, a **Download search results** icon appears in the search bar.
- Click the icon to export the full current search result set, not just the visible page.
- You will be prompted to enter a file name before the download starts.
- The downloaded file is a CSV with these columns:
	`dbId`, `displayName`, `schemaClass`
- This download action is only available after a search and is not shown for `@Staged` lists.

Supported advanced operands:

- `Contains`
- `Equal`
- `Not Equal`
- `IS NULL`
- `IS NOT NULL`

#### Row and bulk actions

Per-row actions can include:

- Launch/open instance
- Delete
- Show referrers
- Copy/clone
- Compare instances
- Show tree (for event classes)

List-level tools:

- Select all on page
- Deselect all
- Delete selected
- Compare selected (available when exactly 2 selected)
- Pagination controls

#### Batch edit

- Click the **Batch Edit** icon in the search bar.
- If specific rows are selected, batch edit applies to selected rows; otherwise it applies to the current list scope.
- If staged changes exceed the configured limit, batch edit is blocked until you commit.

Batch-edit dialog supports editing by attribute type (instance, text, boolean) with the following actions.

##### Batch edit actions by attribute type

**Instance attributes**

- **Single-valued**:
	- **Set via Creation**
	- **Set via Selection**
	- **Delete**
- **Multi-valued**:
	- **Add via Creation**
	- **Add via Selection**
	- **Replace via Creation**
	- **Replace via Selection**
	- **Delete**

**Text attributes**

- **Single-valued**:
	- **Replace Text**
	- **Delete**
- **Multi-valued**:
	- **Add New Text**
	- **Replace Text**
	- **Delete**

**Boolean attributes**

- Use the toggle to set the new value across selected rows.

When using replacement/deletion in batch mode, the dialog can prompt for aggregated existing values so you can target which values are replaced/removed.

### 5.4 Instance view/editor

When you open an instance, the instance toolbar includes:

- QA report/check action
- Show referrers
- Compare against database reference (when available)
- Delete instance
- Upload/commit instance
- Add bookmark
- More actions (expand): copy, compare two instances, open Event View / Schema View toggle for event classes

Additional behaviors:

- Edited/deleted instances are visually highlighted.
- Instance table below the toolbar is where attribute edits are made.
- Breadcrumb/history appears when enabled by parent view.

#### Attribute editing actions (instance table)

The instance table supports different edit actions depending on attribute type and cardinality.

##### Attribute Editing Quick Reference

| Attribute Type | Cardinality | Instance Editor Actions | Batch Edit Actions |
|---|---|---|---|
| Instance | Single-valued | Set via Creation; Set via Selection; Delete; drag bookmark to set value | Set via Creation; Set via Selection; Delete |
| Instance | Multi-valued | Add via Creation; Add via Selection; Replace via Creation; Replace via Selection; Delete; drag bookmark to add; reorder values | Add via Creation; Add via Selection; Replace via Creation; Replace via Selection; Delete |
| Text/String | Single-valued | Edit text directly; Text Editor (find/replace); undo per attribute | Replace Text; Delete |
| Text/String | Multi-valued | Edit existing entries; add empty row value; undo per attribute | Add New Text; Replace Text; Delete |
| Integer / Float | Single-valued | Edit numeric value directly; undo per attribute | Replace value via attribute editor |
| Integer / Float | Multi-valued | Edit numeric entries directly; add empty row value; undo per attribute | Replace value via attribute editor; Delete targeted values |
| Boolean | Single-valued | Toggle true/false; undo per attribute | Toggle/set selected rows |
| Boolean | Multi-valued | N/A in typical schema usage | Toggle/set selected rows |

##### Direct value editing

- **String**: edit in textarea; commit on change (or with `Ctrl+Enter`).
- **Integer/Float**: edit in numeric input.
- **Boolean**: toggle on/off.
- **NoManualEdit attributes**: read-only.

##### Instance-valued slot action menu

Right-click/context-click on an instance-valued field to open the action menu.

- **Single-valued**:
	- **Set via Creation**
	- **Set via Selection**
	- **Delete**
- **Multi-valued**:
	- **Add via Creation**
	- **Add via Selection**
	- **Replace via Creation**
	- **Replace via Selection**
	- **Delete**

##### Bookmark drag-and-drop

- Drag a bookmarked instance onto a compatible instance-valued slot to add/set that value.
- Multi-valued instance slots also support drag-drop ordering of existing values.

##### Reset/undo per attribute

- For actively edited attributes, an **undo** icon appears in the value row (when comparison/reference column is visible).
- Undo resets the current attribute to the database/right-side reference value.

##### Text editor dialog (for `text` attribute)

The text editor includes find/replace tools:

- Search and highlight matches
- Navigate previous/next match
- Replace current match
- Replace all matches
- Clear current search highlights

### 5.5 Staged changes panel

Open by clicking counts in the status toolbar.

It has three sections:

- **New Instances**
- **Updated Instances**
- **Deleted Instances**

Each section supports:

- Select all / deselect all
- Section-specific reset/delete/restore actions
- Commit selected (upload icon)

This is the main place to review and commit or undo staged work in bulk.

## 6) Event View

Event View combines tree navigation, diagram work, and instance editing.

Layout:

- **Left panel**: event filter + event tree (or staged-changes panel when toggled)
- **Upper right**: pathway diagram area
- **Lower right**: instance editor
- **Right edge**: bookmarks panel
- **Bottom**: status toolbar

### 6.1 Layout and panel controls

- The left tree panel can be resized horizontally.
- The diagram and instance editor split can be resized vertically.
- The **BOOKMARKS** strip can be expanded/collapsed and dragged along the right edge.
- The status toolbar can switch the left panel between the event tree and the staged-changes list.

### 6.2 Event filter

- Species dropdown (default **All**) with supported species options.
- Text filter input (press Enter) for event name/dbId filtering.
- Event View filtering is simple text/dbId filtering only; use Schema View for advanced attribute search.

### 6.3 Event tree actions

For each event node you can:

- Expand/collapse hierarchy
- Focus/unfocus node
- Add event to diagram
- Create empty diagram (when available)
- Toggle release flag for the selected event.
- Shift+click the release flag to toggle release/unrelease for that event and all children under it.
- Open/click event to load details into the instance editor

Additional visual cues in the tree:

- Events can be highlighted by the current tree filter.
- Events with diagrams are visually distinguished from events without diagrams.
- The currently focused event is visually marked.

### 6.4 Pathway diagram features

- Selecting an event in the tree can highlight/select its objects in the diagram.
- Selecting objects in the diagram loads the corresponding instance in the lower editor.
- The diagram label changes color when there are unsaved diagram edits.
- A context action menu is available in the diagram for editing and navigation actions.

Diagram action menu includes, depending on selection and edit mode:

- Enable or disable diagram editing
- Enable or disable reaction edge editing
- Add or remove edge points
- Add or remove flow lines
- Resize compartments and pathway nodes
- Insert or delete compartments
- Remove reactions
- Delete pathway nodes when allowed
- Align multiple selected nodes vertically or horizontally
- Toggle diagram color theme
- Upload diagram changes
- Reload the current pathway diagram
- Open or create the related `PathwayDiagram` instance
- Go to a nested pathway from the diagram

### 6.5 Instance editor behavior in Event View

- The lower instance editor uses the same attribute editing tools as Schema View.
- Selecting from either the tree or the diagram updates the instance editor.
- Comparison/history support is available in the Event View instance editor.

### 6.6 Staged changes and bookmarks

- The status toolbar works the same as in Schema View for new, updated, deleted, and default-person tracking.
- In Event View, the status toggle can replace the tree with the staged-changes list in the left panel.
- Bookmarks remain available from the right-side bookmark strip while working in the tree, diagram, and instance editor.

### 6.7 Diagram + instance flow

Typical workflow:

1. Filter/select species and event.
2. Click event to inspect it.
3. Add/focus in diagram as needed.
4. Edit the loaded instance in the lower instance panel.
5. Use status/staged panel to commit or undo changes.

## 7) Gene2Path App

Gene2Path uses LLM services to help annotate a gene against Reactome pathways.

### Basic usage

1. Enter a gene symbol (default shown is prefilled).
2. Click **Submit** (publish icon).
3. Optional: open **Settings** (gear icon) to change configuration before submit.

### Output sections

Depending on results, the page can show:

- Failure message (if request fails)
- **Annotated Pathways** summary/details
- **Predicted Pathways** summary/details
- Protein-protein interaction support tables and summaries
- Navigation side menu for quick jumping between generated sections

### Notes

- A progress bar appears while query is running.
- Generated text includes links to Reactome pathways and PubMed where available.
- Treat generated content as curation assistance that still requires curator review.

## 8) Common workflows

### A) Create and commit a new instance

1. Go to **Schema View**.
2. In class tree, click **Add** next to a class.
3. Edit attributes in instance view.
4. Open staged panel from status bar count.
5. In **New Instances**, select the instance and click **commit** (upload icon).

### B) Edit existing instances and review diffs

1. Open class instance list.
2. Open an instance and edit fields.
3. Use compare/referrers tools if needed.
4. Review in **Updated Instances** panel.
5. Commit selected or reset selected changes.

### C) Delete with safety checks

1. Open an instance.
2. Click **Delete**.
3. Review deletion dialog and referrers warning.
4. Confirm deletion.
5. Commit deletion from **Deleted Instances** panel.

### D) Use local/staged class list

1. Open class tree.
2. Click `(localCount)` next to class.
3. Work in `@Staged` list to review only changed/new/deleted instances for that class.

### E) Work in Event View with tree, diagram, and editor together

1. Open **Event View**.
2. Use the species dropdown and filter box to narrow the event tree.
3. Click an event in the tree to load it into the instance editor.
4. Use the tree action buttons to focus the event, add it to the diagram, or create an empty diagram when needed.
5. Select objects in the pathway diagram to load related instances into the lower editor.
6. If diagram editing is needed, use the diagram context menu to enable editing and apply diagram changes.
7. Upload diagram changes when ready, then use the status toolbar to review and commit staged instance changes.

## 9) Tips and troubleshooting

- If you see the “too many staged instances” warning, commit staged work before continuing large edits.
- Use advanced search for attribute-level filtering; use simple search for quick text/dbId filtering.
- If list actions feel out of sync after major changes, refresh list page or re-open the class list.
- For issues, use the bug-report button in the status toolbar.

## 10) Quick URL reference

- Login: `/login`
- Home: `/home`
- Schema View root: `/schema_view`
- Event View root: `/event_view`
- Gene2Path: `/gene2path`
- Class attributes: `/schema_view/class/{ClassName}`
- DB list by class: `/schema_view/list_instances/{ClassName}`
- Staged list by class: `/schema_view/local_list_instances/{ClassName}`
- Instance view: `/schema_view/instance/{dbId}`
- Event instance view: `/event_view/instance/{dbId}`

---

Later can create role-based short guides (for example, “new curator quick start” vs “advanced curator workflows”), this document can be split into focused variants.