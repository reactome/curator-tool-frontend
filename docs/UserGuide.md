# Reactome WebBench — Curator Tool User Guide

This guide explains how to use the Curator Tool frontend (**Reactome WebBench**) for daily curation tasks. It documents every user interface in the application: the exact buttons, icons, tooltips, dialogs, menus, keyboard shortcuts, and behaviors you will encounter.

## Table of contents

1. [What this site includes](#1-what-this-site-includes)
2. [Sign in and session basics](#2-sign-in-and-session-basics)
3. [Home page](#3-home-page)
4. [The curation model: staging and committing](#4-the-curation-model-staging-and-committing)
5. [Global status toolbar](#5-global-status-toolbar)
6. [Staged-changes panel](#6-staged-changes-panel)
7. [Bookmarks](#7-bookmarks)
8. [Schema View](#8-schema-view)
9. [Instance editor (shared by Schema View and Event View)](#9-instance-editor)
10. [Event View](#10-event-view)
11. [Gene2Path app](#11-gene2path-app)
12. [Paper2Path app](#12-paper2path-app)
13. [Help panel and guided tours](#13-help-panel-and-guided-tours)
14. [Keyboard shortcuts](#14-keyboard-shortcuts)
15. [Common workflows](#15-common-workflows)
16. [Tips and troubleshooting](#16-tips-and-troubleshooting)
17. [Quick URL reference](#17-quick-url-reference)

### Quick links

- [Attribute Editing Quick Reference](#93-attribute-editing-quick-reference)
- [Instance-valued slot action menu](#96-instance-valued-slot-action-menu)
- [Batch edit reference](#84-batch-edit)
- [Diagram context menu reference](#104-pathway-diagram)

---

## 1) What this site includes

After login, the **home page** launches five areas:

- **Schema View** — browse schema classes, list instances, open/edit instances, run batch edits, and manage staged changes.
- **Event View** — work with pathway/event trees, pathway diagrams, and instance editing together.
- **Gene2Path** — submit a gene symbol and review LLM-generated pathway annotation support.
- **Paper2Path** — run a multi-agent (CrewAI) literature-annotation job from PMIDs/PDFs/a gene, then register generated instances into Schema View. *(Experimental.)*
- **Tutorial** — tabbed reference plus interactive guided tours for each area.

Two AI-assistance apps (Gene2Path, Paper2Path) and the Tutorial open in a **new browser tab**; Schema View and Event View open in the same tab.

---

## 2) Sign in and session basics

### Sign in

1. Open the login page (`/login`).
2. The login card is titled **"Login"**. Enter **Username** and **Password** (both are plain fields with placeholder text; there is no client-side validation, so empty submissions are possible — the server decides validity).
3. Click **OK**.

There is **no self-service registration** — accounts are provisioned separately.

**On success**, your session token is stored in the browser, your saved staged instances are loaded, and you are taken to `/home` — or back to whatever protected page you were trying to reach before being sent to login.

**On failure**, an **"Error"** dialog appears with the message **"Wrong user name or password"** and a single **OK** button.

> **Password tip:** passwords containing special characters (`!`, `$`, etc.) are not supported. Use an alphanumeric password.

### Protected vs. public pages

| Area | Route | Login required? |
|---|---|---|
| Login | `/login` | No |
| Home | `/home` | **Yes** |
| Schema View | `/schema_view` | **Yes** |
| Event View | `/event_view` | **Yes** |
| Paper2Path | `/paper2path` | **Yes** |
| Gene2Path | `/gene2path` | **No** (intentionally public — the link is cited in grant applications) |
| Tutorial | `/tutorial` | No |

The empty URL (`/`) redirects to `/home`.

### Session behavior

- **Redirect-back:** if you are bounced to login from a protected URL, a successful login returns you to that saved URL.
- **Silent token refresh:** if your token expires mid-session, the app tries to refresh it transparently in the background so you stay logged in. Only if the refresh fails are you sent back to login (with your current page remembered for redirect-back).
- **Reload:** because your token lives in browser storage, reloading the page keeps you logged in until the token expires.
- **Auto-save:** after ~5 minutes of edit inactivity, and on browser close/reload, your staged instances are persisted automatically.
- **Log out:** clicking **Log out** in the status toolbar persists your current staged state to the server, clears local identity, and returns you to login. If you have no staged changes, any previously server-saved instances for you are cleared.

---

## 3) Home page

The home page shows the Reactome logo and the title **"Reactome WebBench"**, followed by a grid of launch cards:

| Card | Icon | Opens |
|---|---|---|
| **Schema View** | `account_tree` | `/schema_view` (same tab) |
| **Event View** | `timeline` | `/event_view` (same tab) |
| **Gene2Path** | `psychology` | `/gene2path` (new tab) |
| **Paper2Path** | `article` | `/paper2path` (new tab) |
| **Tutorial** | `school` | `/tutorial` (new tab) |

The [global status toolbar](#5-global-status-toolbar) is shown at the bottom of the home page with the staged-instance counters hidden.

---

## 4) The curation model: staging and committing

WebBench uses a **local staging** model. When you create, edit, or delete an instance, the change is held **locally** (staged) — it is **not** written to the database until you explicitly **commit** it.

- Staged changes are tracked in three buckets: **New**, **Updated**, and **Deleted** instances.
- Counts for each bucket appear in the [status toolbar](#5-global-status-toolbar); clicking any count opens the [staged-changes panel](#6-staged-changes-panel).
- Staged changes survive reloads and logout (they are persisted per-user).
- **Committing** uploads staged changes to the database. Committing **new** instances first runs a duplicate-match check (see [§6](#6-staged-changes-panel)).

> **Staged-change limit:** when your combined staged count (New + Updated + Deleted) exceeds **200**, a warning appears and **batch edit is blocked** until you commit. Commit staged work regularly to avoid this.

---

## 5) Global status toolbar

The status toolbar appears at the bottom of Home, Schema View, and Event View.

### Left section — counters

Each is a label plus a count button; the button is **disabled when the count is 0**. Clicking any of the first three opens the combined [staged-changes panel](#6-staged-changes-panel).

- **New instances:** `n`
- **Updated instances:** `n`
- **Deleted instances:** `n`
- **Pathway Diagram Locks:** `n` — clicking opens an inline **"Current Diagram Locks"** flyout listing diagrams you currently hold editing locks on. Each row shows the diagram name and `[dbId]` with an **Open diagram** (`open_in_new`) button that navigates to `/event_view/instance/<dbId>`. A **Close** (`close`) button dismisses the flyout, which also closes on any outside click.
- **Default person:** shows `displayName [dbId]` or **"Not Defined"**. Clicking opens a **"Select default person"** dialog filtered to the `Person` class; the person you pick is stamped as author on your edits.

> All three of New/Updated/Deleted open the **same** combined staged-changes panel.

### "Too many staged instances" warning

When your staged count exceeds **200**, the toolbar shows **"Too many staged instances. Commit them as soon as possible."** (tooltip: *"You have too many staged instances. Please commit your changes to avoid losing them."*).

### Right section — action buttons

| Icon | Tooltip | Action |
|---|---|---|
| `account_tree` | **Go to schema view** | Navigate to `/schema_view` (shown from Event View / Home) |
| `timeline` | **Go to event view** | Navigate to `/event_view` (shown from Schema View / Home) |
| `home` | **Go to home page** | Navigate to `/home` |
| `restore` | **Restore staged-changes backup** | Opens the [Restore Staged-Changes Backup](#restore-staged-changes-backup) dialog |
| `file_download` | **Export staged instances to a local file** | Opens the [Export staged instances to a local file](#export-staged-instances-to-a-local-file) flow |
| `file_upload` | **Load staged instances from a local file** | Opens the [Load staged instances from a local file](#load-staged-instances-from-a-local-file) flow |
| `menu_book` | **User guide** | Opens this guide on GitHub in a new tab |
| `bug_report` | **Report bug** | Opens the bug-report Google Doc in a new tab |
| `logout` | **Log out** | Persists staged state, then returns to `/login` |

Backend errors surface as a snackbar at the bottom with a **Close** action.

#### Restore staged-changes backup

Every time your staged changes (new/updated/deleted instances, bookmarks, default person) are saved to the server and a previous save already existed, the server automatically keeps a timestamped backup of what was there before — this happens as a side effect of normal saving, with no action needed from you. The **Restore staged-changes backup** dialog lists your available backups (most recent first) with a **Restore** button on each row.

Clicking **Restore** first asks you to confirm (since it replaces what's currently in your editor), then loads that backup's new/updated/deleted instances, bookmarks, and default person into your current editing session. **This only loads the backup — it does not save anything by itself.** Your last-saved state on the server is untouched either way; review the restored changes and use the normal save action (or simply keep working) if you want to keep them. The server keeps a rolling history of your most recent backups (older ones are pruned automatically).

#### Export staged instances to a local file

The **`file_download`** button downloads your currently staged new/updated/deleted instances, bookmarks, and default person as a JSON file on your own computer — mainly intended as a debugging/inspection aid, and as a manual backup you keep yourself (separate from the server's automatic backups above).

Clicking it opens an **"Export Staged Instances"** dialog with a **File name** field pre-filled with a timestamped default (e.g. `user-instances-2026-07-30T20-45-12-345Z.json`); edit it if you want a different name, then click **Export** (`.json` is appended automatically if you leave it off). **Cancel** closes without downloading.

#### Load staged instances from a local file

The **`file_upload`** button is the counterpart to the export above — it loads a previously exported JSON file back into your current editing session.

1. Click **`file_upload`** and choose a `.json` file (only use a file previously produced by **Export staged instances to a local file** above).
2. A confirmation dialog warns that this **replaces** your currently staged (unsaved) changes in the editor. Confirm to proceed, or cancel to back out.
3. Before loading the file, whatever you currently have staged is **automatically saved to the server as a backup** — so if you want it back afterward, use **Restore staged-changes backup** (above) to recover it. The file's content then replaces your staged instances.
4. On success, an **"Instances Loaded"** dialog confirms the file has been loaded — review the changes and commit/save as usual if you want to keep them.

> **Multi-tab note:** if you have more than one browser tab open, loading a file (or restoring a backup, above) updates the staged instances in **every** open tab, not just the one you loaded it in — so all your tabs stay showing the same state.

---

## 6) Staged-changes panel

Open it by clicking any of the New/Updated/Deleted counts. It replaces the left panel in Schema View and Event View, and has a **Close** (`close`) button at the top. It contains three resizable sections (drag the dividers between them to change their heights).

Each section header reads **"<Section> Instances: {total} ({selected})"** and has an action row. Clicking a staged row typically opens it in **comparison view** so you can see your changes against the database copy.

### New Instances

- `select_all` — **select all**
- `deselect_all` — **deselect all**
- `delete` — **delete all selected new instances** (opens a confirm dialog)
- `upload` — **commit all selected** (commits sequentially)
- Per-row buttons: **DELETE**, **COMMIT**

### Updated Instances

- `select_all` / `deselect_all`
- `undo` — **undo all changes for selected updated instances** (re-fetches each from the DB and resets)
- `upload` — **commit all selected** (commits sequentially; any failures are reported afterward listing `#dbId displayName` of each failure)
- Per-row buttons: **COMPARE2DB**, **UNDO**, **COMMIT**

### Deleted Instances

- `select_all` / `deselect_all`
- `undo` — **restore all selected deleted instances**
- `upload` — **commit all selected** (processes the deletions)
- Per-row buttons: **UNDO**, **COMMIT**

### Commit dialogs and the duplicate-match check

- While a commit runs, a modal **commit-wait dialog** shows a spinner with a title such as **"Committing Updated Instance(s)"**, **"Committing New Instance"**, or **"Committing Deleted Instances"**.
- **New-instance duplicate check:** before a new instance is committed, WebBench runs a match check against the database. If matches are found, a **"Matches Found"** dialog appears explaining the matched new instance(s) were **not committed** and lets you resolve each one. Each new instance gets a group header (`{displayName} [{dbId}] — {SchemaClass}` with a `{n} match(es)` badge) and an **Action** dropdown:
  - **Do Nothing** (default) — leave the new instance uncommitted (staged, unchanged).
  - **Commit as a new instance** — commit it anyway despite the match.
  - **Use a DB instance instead** — discard the new instance and repoint everything that referenced it at a chosen existing match.
  - **Merge into a DB instance** — copy the new instance's attributes onto a chosen existing match (single-valued overwritten, multivalued appended), repoint references, and discard the new instance.

  Choosing **Use a DB instance instead** or **Merge into a DB instance** reveals an **Existing instance** dropdown (listing the matches as `{displayName} [{dbId}]`) to pick the target. A **Show matches / Hide matches** toggle expands the matches table (columns **dbId** and **Display Name**; hovering a name shows `[SchemaClass]`), with a **launch instance** (`launch`) button per match that opens it in a new tab. Resulting edits are staged for review, not committed immediately. **Apply** is disabled (tooltip **"Choose an action for at least one instance"**) until at least one group has a non-default action; **Cancel** closes without changes.
- After a successful commit, a **commit-result dialog** (title **"Committed Instances"**, or **"Deleted Instances"** for deletions) lists the affected instances with **dbId** and **Display Name**; committed (non-deleted) rows include an `open_in_new` button that opens the instance in a new tab.

---

## 7) Bookmarks

Bookmarks give you fast access to instances you use repeatedly — and let you drag an instance directly into a compatible attribute slot.

### Adding a bookmark

- From an instance-list row: the `bookmark` button (tooltip **"add bookmark"**), disabled for deleted instances.
- From the instance editor toolbar: the `bookmark` button (tooltip **"Add Bookmark"**).

### The BOOKMARKS strip

A vertical **BOOKMARKS** handle is anchored to the right edge of Schema View and Event View. Click it to slide the panel open/closed (it starts closed); you can also **drag** the handle along the right edge to reposition it.

Inside the panel:

- Bookmarks can be **reordered** by dragging.
- Each row has an **open/navigate** button (`open_with` icon + the instance's display name; tooltip shows `<SchemaClass> [dbId]`) that navigates to the instance, and a **remove** button (`clear` icon, tooltip **"Remove Instance"**).
- Empty state: **"No bookmarks to show"**.

**Drag-and-drop onto attribute slots:** drag a bookmark onto a compatible instance-valued attribute in the editor to set/add it. Valid drop targets highlight **green**, invalid ones **red**.

Bookmarks maintain themselves: a bookmarked instance is removed automatically when it is deleted, and a new instance's bookmark is re-pointed to the real database instance once committed.

---

## 8) Schema View

Schema View is the main curation workspace at `/schema_view`.

**Layout:**

- **Left panel** — the schema class tree (or the staged-changes panel when toggled from the status bar; the choice is remembered).
- **Main panel** — routed content: a welcome page, a class-attributes table, an instance list, or the instance editor.
- **Right edge** — the [BOOKMARKS](#7-bookmarks) strip.
- **Bottom** — the [status toolbar](#5-global-status-toolbar).

The left divider is draggable to resize the sidebar (default width 400px). The default landing panel is an informational **"Reactome WebBench: Schema View"** welcome card (no controls).

### 8.1 Schema class tree (left)

A fully-expanded tree of Reactome classes. Each node offers:

- **Class-name link** → class attributes page (`/schema_view/class/{ClassName}`).
- **`[count]` link** → the database instance list (`/schema_view/list_instances/{ClassName}`). This is the number of instances in the database.
- **`(localCount)` link** — shown only when you have staged changes for the class; opens the staged/local list (`/schema_view/local_list_instances/{ClassName}`).
- **Add icon** (`add_box`, tooltip **"Click to create new {ClassName}"**) → creates a new instance of that class and opens it in the editor. Hidden for abstract classes.

Counts update automatically as you create, commit, update, or delete instances.

### 8.2 Class attributes page

Heading: **"Attributes of class '{ClassName}'"**. A sortable table (all columns sortable) with these columns:

- **Attribute Name**
- **Cardinality** (`1` = single-valued, `+` = multi-valued)
- **Value Type** — for `Instance` types, links to the allowed class page
- **Category** (Mandatory / Required / Optional / NoManualEdit)
- **Attribute Origin** — the class that defines the attribute (links to that class)
- **Defining Type**

Rows for the class's **own** (non-inherited) attributes are highlighted in color. A footer legend explains the coloring, the bracketed instance counts, and the `+` cardinality marker.

### 8.3 List Instances page

The header toolbar shows the source:

- **`{ClassName}@Database`** — the database-backed list.
- **`{ClassName}@Staged`** — the local/staged list (only your changed/new/deleted instances for that class).

**Table columns:** **dbId**, **Display Name**, and per-row **action buttons**.

- In the **dbId** column, updated instances show a small gold `star` icon (tooltip **"Modified"**).
- Hovering a **Display Name** appends the schema class in gray brackets `[SchemaClass]`.
- Deleted rows are shown with a distinct (deletion) highlight rather than being hidden.
- Empty state: **"No instance matching the search key"**.
- Pagination: page sizes **20 / 50 / 100** (default 20), with first/last-page buttons.

#### Search modes

- **Simple search:** type in the **Search** box and press **Enter** (matches display name / dbId).
- **Advanced search:** click the `manage_search` icon (**"Advanced Search"**) to switch modes. The search box becomes read-only and shows the composed query; build conditions in the filter panel:
  - **Select attribute** dropdown.
  - **Select operand** dropdown — supported operands: **Equal**, **Not Equal**, **Contains**, **IS NULL**, **IS NOT NULL**.
  - **Enter search term** input, with a **Search the query above** (`query_stats`) button.
  - **Enter** adds another condition; **Ctrl+Enter** completes and runs the search. Use the **Undo last** (`undo`) icon to remove the most recent condition. Switch back with the `manage_search` (**"Simple Search"**) icon.

#### Download search results (CSV)

- After a search on a `@Database` list, a **Download search results** (`download`) icon appears in the search bar (not shown on `@Staged` lists, and only when there are results).
- You are prompted for a file name (`.csv` is appended if missing). The export contains the **full** result set, not just the visible page.
- CSV columns: `dbId`, `displayName`, `schemaClass`.

#### Per-row actions

A checkbox toggles row selection (`check_box_outline_blank` → **select**, `check_box` → **unselect**). Primary actions on the DB list:

- `launch` — **launch instance** (opens the instance editor in a **new tab**)
- `delete` — **delete instance** (opens the deletion dialog)
- `list_alt` — **show referrers**

Behind the **`more_horiz`** (**expand**) button:

- `content_copy` — **clone instance**
- `compare_arrows` — **compare two instances**
- `timeline` — **open event view** (event classes only)
- `bookmark` — **add bookmark** (when enabled; disabled for deleted rows)

#### List-level tools

Shown above the paginator with a **"Selected Instances: {n}"** count:

- `check_box_outline` — **Select all on page**
- `deselect_all` — **Deselect all**
- `delete` — **Delete selected** (opens a bulk-delete confirm dialog)
- `compare_arrows` — **Compare instances** (only when **exactly 2** are selected)
- `edit_square` — **Batch Edit** (when ≥1 selected)
- `download` — **Download selected** (CSV, columns `dbId,displayName,schemaClass`; prompts for filename)
- `upload` — **commit all selected** (staged list only)

#### Related dialogs

- **Select an Instance** — a schema-class dropdown plus two tabs, **Database Instances** and **New and Updated Instances**, with a **Selected Instances** list; **OK** / **Cancel**. Single-valued targets show *"Only one value may be selected for {attribute}."*
- **Confirm Delete** (bulk) — *"Are you sure you want to delete these {n} instances?"* with a note that database instances are only removed after you commit the deletions; **Delete** / **Cancel**.

### 8.4 Batch edit

Batch edit applies a single change across many instances at once. Open it from the **Batch Edit** (`edit_square`) icon.

- If **no rows are selected**, an info dialog **"No instances selected"** asks you to select rows first.
- If your staged count exceeds **200**, an info dialog **"Too many changes"** blocks batch edit until you commit.

The dialog is titled **"Batch Edit for Selected Instances"**:

- **Attribute** dropdown (*"Select an Attribute to Edit"*) — only attributes common to all selected instances' classes, excluding `NoManualEdit`.
- **Edit Action** — the actions available depend on attribute type and cardinality (below).
- **Batch Edit Summary** — a running description after each action (e.g. *"'X' set in 'attr' for N instances."*, with a note if some instances already had the value and were skipped).
- **Selected Instances** / **Removed Instances** lists — remove a row (`close`, **"remove instance"**) to exclude it, or restore it (`undo`, **"reset instance"**).
- **Close** finishes.

#### Actions by attribute type / cardinality

**Instance attributes**

- **Single-valued:** **Set via Creation**, **Set via Selection**, **Delete**
- **Multi-valued:** **Add via Creation**, **Add via Selection**, **Replace via Creation**, **Replace via Selection**, **Delete**

**Text / String attributes**

- **Single-valued:** **Set New Text**, **Replace Text**, **Delete** (a **New Value** / **Replaced Value** field appears)
- **Multi-valued:** **Add New Text**, **Replace Text**, **Delete**

**Numeric (Integer / Float):** a numeric input applies a scalar replace.

**Boolean:** a **True / False** radio group plus a **Set** button (disabled until you pick a value; tooltip *"Select True or False first"*).

For **Delete**, **Replace…**, and **Replace Text**, the tool first opens an **aggregated-values** dialog (*"Values of '{attribute}' for selected instances:"*) so you can pick exactly **which existing values** to target (with checkboxes, or launchable rows for instance values); **OK** / **Cancel**.

---

## 9) Instance editor

The instance editor is used both in Schema View (`/schema_view/instance/{dbId}`) and, embedded, in Event View. It is the same component in both places.

### 9.1 Breadcrumb / navigation history

When history is enabled (always in Event View), a breadcrumb bar shows the instances you have visited, each as a clickable **dbId** link (hover shows `SchemaClass: displayName`). Clicking an earlier crumb jumps back **and discards** the forward history after it. Deleting/committing the displayed instance removes it from history.

### 9.2 Toolbar

The title reads **"{SchemaClass}: {displayName} [{dbId}]"**. It turns **red** when the instance has unsaved edits or is new, and shows **strikethrough** when marked deleted.

**Always-visible buttons:**

| Icon | Tooltip | Notes |
|---|---|---|
| `checklist` | **Run QA Report** (or *"You may need to commit your changes first for the QA Report"* when edits are pending) | Icon is blue (not run), **green** (passed), or **red** (failed) |
| `list_alt` | **Show Referrers** | |
| `compare` | **compare to instance at db** / **turn off comparison** | Enabled only when a database copy is available; toggles the comparison column |
| `delete` | **Delete Instance** | Opens the deletion dialog |
| `upload` | **Upload** | Commits this instance; enabled only when there are changes |
| `download` | **Export event to DOCX** | Event classes only; blocked while staged instances are pending |
| `manage_search` | **Match new instance in database** | New instances only |
| `bookmark` | **Add Bookmark** | |

**Behind the `more_horiz` (expand) button:**

- `content_copy` — **clone instance**
- `compare_arrows` — **compare two instances** (opens a *"Compare {name} to"* picker)
- `merge_type` — **merge with another instance** (opens the [Merge Instances dialog](#98-supporting-dialogs))
- `swap_horiz` — **change schema class** (opens the [Change Schema Class dialog](#98-supporting-dialogs))
- `open_in_new` — **open in curator graph** (external; disabled for new instances)
- `account_tree` — **open schema view** *(in Event View)* / `timeline` — **open event view** *(in Schema View)* — event classes only

### 9.3 Attribute Editing Quick Reference

| Attribute Type | Cardinality | Instance-editor actions | Batch-edit actions |
|---|---|---|---|
| Instance | Single | Set via Creation; Set via Selection; Delete; drag bookmark to set | Set via Creation; Set via Selection; Delete |
| Instance | Multi | Add via Creation; Add via Selection; Replace via Creation; Replace via Selection; Delete; drag bookmark to add; reorder; set Stoichiometry (`input`/`output`/`hasComponent`/`repeatedUnit` only) | Add/Replace via Creation/Selection; Delete |
| Text/String | Single | Edit in textarea; rich Text Editor (find/replace); undo | Set New Text; Replace Text; Delete |
| Text/String | Multi | Edit entries; add empty row; undo; reorder | Add New Text; Replace Text; Delete |
| Integer / Float | Single | Edit numeric value; undo | Replace via numeric input |
| Integer / Float | Multi | Edit numeric entries; add empty row; undo; reorder | Replace; Delete targeted values |
| Boolean | Single | Toggle true/false; undo | Set True/False on selected rows |

### 9.4 The attribute table

Columns: **Attribute**, **Value**, and (when comparing) a reference column headed **Database Value** (comparing to the DB copy) or the other instance's display name (comparing two instances).

**Attribute-name cell:** shows a category icon — **Mandatory**, **Required**, **Optional**, or **NoManualEdit** — and is color-coded:

- **Light-orange** = a Required attribute that is empty
- **Red** = a Mandatory attribute that is empty
- **Bold purple** = actively edited
- **Italic brown** = passively (automatically) edited
- **Bold + italic** = both

Hovering the attribute name shows a tooltip explaining its state. Hovering column headers reveals extra controls: **Sort attributes by name** (`sort_by_alpha`), **Sort by defined attributes** (`sort`), an **edited attributes** filter (`filter_list`), a category filter (`filter_alt` → Mandatory/Required/Optional/NoManualEdit checkboxes), and an **attributes having different values** filter on the reference column.

### 9.5 Direct value editing

- **String:** an auto-sizing textarea. **Enter commits** the edit; **Ctrl+Enter / ⌘+Enter inserts a newline** instead. On a Summation `text` attribute, an inline **Edit Text** (`edit`) pencil opens the rich [Text Editor dialog](#96-text-editor-dialog).
- **Integer:** numeric input, digits only (leading `-` allowed).
- **Float:** numeric input, one decimal point (leading `-` allowed).
- **Boolean:** a slide toggle; commits immediately.
- **NoManualEdit** attributes are read-only.
- **Undo/reset:** for an actively edited attribute, an `undo` icon appears in the value cell when the comparison column is shown; it resets the attribute to the reference value (tooltip **"reset to the db value"** or **"set to the right value"**).
- **Multi-valued** attributes support **drag-to-reorder** (except NoManualEdit) and an extra empty row to add a new value.

### 9.6 Instance-valued slot action menu

For instance-valued attributes, open the action menu by clicking the edit pencil/fab or **right-clicking** the value. An empty slot shows an **Edit** button (tooltip **"Set value"** / **"Add value"**); a populated slot shows an edit pencil (**"Edit value"**).

- **Single-valued:** **Set via Creation** (`add_box`), **Set via Selection** (`search`), **Delete** (`delete`)
- **Multi-valued:** **Add via Creation** (`add_box`), **Add via Selection** (`search`), **Replace via Creation** (`switch_access_shortcut_add`), **Replace via Selection** (`find_replace`), **Delete** (`delete`)
- **Stoichiometry** (`tag`) — shown only for the multivalued stoichiometry attributes (`input`, `output`, `hasComponent`, `repeatedUnit`) on a populated value; opens the [Set Stoichiometry dialog](#98-supporting-dialogs).

"via Creation" opens the **Create a New Instance** dialog (pick a schema class, fill in attributes); "via Selection" opens the **Select an Instance** dialog.

#### Stoichiometry (number of copies)

For the multivalued attributes **`input`**, **`output`**, **`hasComponent`**, and **`repeatedUnit`**, a value can appear more than once (its **stoichiometry** = number of copies). There is no separate stoichiometry field in the add dialogs — you raise the count by **adding the same instance again** (duplicates are permitted for these attributes only), then fine-tune the exact count with the **Stoichiometry** action.

- A value with more than one copy is shown with a **`{n} ×`** prefix before its name (e.g. `3 × ATP [113592]`).
- When the value is editable, the count renders as a small clickable chip (tooltip **"Set stoichiometry"**); clicking it — or choosing **Stoichiometry** from the action menu — opens the **Set Stoichiometry** dialog. The chip also appears on hover for single-copy values so you can increase the count.

> **Species warning:** editing the `species` attribute first shows a warning that changing species may change the `stId` / `stableIdentifier`.

**Bookmark drag-and-drop:** drag a bookmark onto a compatible slot to add/set it (valid targets highlight green, invalid red).

### 9.7 Text editor dialog

Titled **"Edit Text"**, a rich-text editor for long `text` attributes. A **Find and replace** (`find_replace`) FAB toggles the find/replace toolbar:

- **Search text** field (Enter or `search` icon runs the search) with a **`{current}/{total}`** match counter.
- **previous match** (`keyboard_arrow_up`), **next match** (`keyboard_arrow_down`), **clear** (`close`).
- **Replace** field with **Replace current match** (`redo`) and **Replace all** (`cached`).

Highlights are removed automatically when you click **OK** (keep changes) or **Cancel** (discard).

### 9.8 Supporting dialogs

- **Referrers** — titled *Referrers of "{name} [{dbId}]"*, grouped by attribute with counts; each referrer has a **launch** button. Shows **"Total Referrers: {count}"** (very large lists are truncated). In a deletion context, instances that would be structurally affected are shown in red.
- **QA Report** — titled *QA Report for "{name}"*; passed checks show green **" Passed"**, failed checks render a table with clickable instance links.
- **Delete** — titled *Delete "{name} [{dbId}]"*, with an optional structural-change warning and a **Show Referrers / Hide Referrers** toggle; **Delete** / **Cancel**. A separate **Confirm Delete** step notes that database instances are only removed after you commit the deletion. You may also be offered to **create a "Deleted" instance** to record the deletion.
- **Match Instances** — titled *Matched instances for {name}*; select an existing instance and click **OK** to navigate to it.
- **Create a New Instance** — pick a schema class, then fill in attributes; **OK** / **Cancel**.
- **Change Schema Class** — titled **"Change Schema Class"**. Shows the **Current class** and the instance as `{displayName} [{dbId}]`, then a **New schema class** dropdown listing the concrete classes (the current class excluded). On open it loads the class list and checks every referrer (**"Loading classes and checking referrers…"**). If the chosen class would break any reference, a block appears headed *"{NewClass} is not accepted by these referrers:"* listing each offending referrer as a clickable `{displayName} [{dbId}]` link (tooltip **"open in new tab"**, opens the referrer in a new tab) with the attribute and its allowed classes, plus the hint *"Resolve or remove these references before changing the class."* The **Change Class** button (`check`) stays disabled until a valid, conflict-free class is selected; **Cancel** (`close`) closes without changes. Applying keeps the same dbId, preserves shared attribute values, regenerates the display name, and reloads the instance (no separate confirmation step).
- **Set Stoichiometry** — titled **"Set Stoichiometry"**. Shows the value's display name and a **Number of copies** numeric input (minimum 1; **Enter** confirms), with a hint **"Currently {n}."** **OK** (`check`) applies the new count; **Cancel** (`close`) leaves it unchanged.
- **Merge Instances** — see [Merging two instances](#99-merging-two-instances).

### 9.9 Merging two instances

The `merge_type` button behind **more_horiz** merges the displayed instance with a second one. You first pick the second instance from the usual *"Merge {name} with"* list dialog — its class dropdown also offers the ancestor classes, so the second instance does not have to be of the same class. The **Merge Instances** dialog then labels the two instances **1** (the one you started from) and **2**, and offers two ways to combine them.

**Create a new merged instance and pick the values.** A brand new instance is created and you choose, attribute by attribute, which values it gets. Both originals are left completely untouched.

- **New instance class** — the class both instances share. Two instances of the same class merge into that class; otherwise the nearest common ancestor is used. When that ancestor is abstract and so cannot be instantiated (Complex and DefinedSet meet only at PhysicalEntity, for example), instance **1**'s class is used instead and the dialog says so — attributes that only instance **2**'s class defines cannot be carried over.
- **Single-valued attributes** `[1]` — a radio choice between instance **1**'s value, instance **2**'s value, or neither. Defaults to instance **1** when it has a value.
- **Multivalued attributes** `[+]` — a checkbox per individual value on each side, so you can build any combination. Everything is selected by default (the union). The chosen values are written in column order: instance **1**'s picks first, then instance **2**'s, with duplicates dropped (instances compared by dbId).
- **Row shortcuts** — `merge_type` takes both sides deduplicated, `clear` leaves the attribute empty. The **All rows: 1 / 2 / Both / None** buttons apply the same shortcut to every visible row.
- **Hide empty attributes** — on by default; turn it off to see attributes neither instance has a value for.
- Server-managed and provenance slots (`created`, `modified`, `reviewed`, `authored`, `_doRelease`, `releaseStatus`, …) are never offered, the same as when cloning.

Clicking **Merge** creates the instance, generates its display name, stages it as a new instance, and navigates to it.

**Merge one instance into the other.** Pick the direction; the *source* is merged away into the *target*.

- Every single-valued attribute the source has a value for **overwrites** the target's value.
- Every multivalued attribute's values are **appended to the end** of the target's list, skipping values the target already holds.
- A preview table shows exactly what will happen to each attribute of the target before you commit to it.
- Every instance referring to the source is **repointed at the target** and staged as an update. Referrers are loaded from the server first, so referrers not already open in your session are included too. The dialog shows the referrer count once you choose this mode (this is a heavier server query, so it is not run for the pick-and-choose mode) and blocks the merge if the source has more than 200 referrers — move those references in smaller batches, or merge in the other direction.
- The source is then **marked for deletion**.

Nothing reaches the database until you commit the staged changes; until then the merge can be undone by resetting the staged instances.

---

## 10) Event View

Event View (`/event_view`) combines tree navigation, pathway-diagram viewing/editing, and instance editing.

**Layout:**

- **Left panel** — event filter + event tree (or the staged-changes panel when toggled).
- **Top-right** — the pathway diagram.
- **Bottom-right** — the instance editor.
- **Right edge** — the BOOKMARKS strip.
- **Bottom** — the status toolbar.

Until you select an event, the right side shows a welcome banner (**"Reactome WebBench: Event View"**) with usage hints.

### 10.1 Layout controls

- Drag the **vertical bar** on the right edge of the tree to resize the tree width.
- Drag the **horizontal bar** between the diagram and the editor to change the split.
- Click the **BOOKMARKS** handle to open/close the bookmarks strip (drag to reposition).
- The status toolbar can **swap the tree for the staged-changes panel** in the left panel (the choice is remembered per session).

### 10.2 Event filter

- **species** dropdown — options: **All** (default), **Homo sapiens**, **C. elegans**, **D. melanogaster**, **Gallus gallus**, **Fugu rubripes**, **Mus musculus**.
- **filter** input — press **Enter** to filter by event **name** (text) or **dbId** (digits). Tooltip: *"Use text to filter for name and number for dbId. Use schema view for advanced search."* (Event View filtering is simple only; use Schema View for attribute-level search.)

### 10.3 Event tree

Each node row provides, left to right:

- **Expand/collapse** (`expand_more` / `chevron_right`).
- **Focus/unfocus** (`center_focus_strong`, tooltip **"Click to focus/unfocus"**) — isolates the node's ancestor path and descendants.
- **Add to diagram** (`new_label`, tooltip **"Click to add this event to diagram"**).
- **Create empty diagram** (`schema`, tooltip **"Click to create an empty diagram"**) — shown only for non-reaction nodes that don't already have a diagram.
- **Release flag** — an image with a native tooltip: released shows *"released. click to unrelease. shift + click to unrelease all under this event"*; not-released shows the release equivalent. **Shift+click cascades** the release/unrelease to the node and all its descendants; each toggle registers the instance as updated.
- **Class-name icon** — indicates Reaction, Pathway, BlackBoxEvent, Polymerisation, etc.
- **Event name** — click to load the event.

**Visual cues:** filter matches are **dodgerblue**; events **with** a diagram are **bold** (without are normal weight); the **focused** node has a light-blue background.

**Behaviors:**

- Clicking an event name navigates to the nearest ancestor that has a diagram and selects the clicked object in it. If no diagram exists in that branch, an info dialog explains you must create an empty diagram first.
- Adding a reaction to a diagram is blocked (with an info dialog) if the reaction is not contained by the displayed pathway.

### 10.4 Pathway diagram

The diagram label shows the pathway name and **turns red when there are unsaved edits**; a `lock` icon (tooltip **"Diagram is locked by you"**) appears while you hold the editing lock.

**Selection stays in sync** across the tree, the diagram, and the instance editor — selecting in one highlights/loads in the others.

#### Diagram toolbar

A persistent toolbar sits above the diagram canvas with icon buttons (hover for tooltips) for the global, mode-level actions — these don't require right-clicking a specific element first:

| Icon | Action | Shown / enabled when |
|---|---|---|
| `edit` | **Enable Editing** | Not currently editing |
| `edit_off` | **Disable Editing** | Currently editing |
| `lock_open` | **Unlock Diagram** | You hold the editing lock |
| `add` | **Zoom In** | Always |
| `remove` | **Zoom Out** | Always |
| `zoom_out_map` | **Fit to Screen** | Always |
| `undo` | **Undo** | While editing, and there is a step to undo |
| `redo` | **Redo** | While editing, and there is a step to redo |
| `add_box` | **Insert Compartment** | While editing |
| `align_horizontal_center` | **Align Centers Vertically** | While editing, with 2+ alignable nodes selected |
| `align_vertical_center` | **Align Centers Horizontally** | While editing, with 2+ alignable nodes selected |
| `block` | **Disable All Resizing** | While editing, only appears if any compartment currently has resize widgets showing |
| `brightness_4` | **Toggle Color Theme** | Always |
| `cloud_upload` | **Upload Diagram** | There are unsaved edits |
| `refresh` | **Reload Pathway Diagram** | Always |
| `description` | **Edit/Create PathwayDiagram** | Always |

**Right-click** also opens the classic context menu — it still offers most of the actions above (both access points work identically) plus every element-specific action, context-sensitive to what you clicked. Zoom In / Zoom Out / Fit to Screen are toolbar-only (view-level controls, not tied to any right-clicked element):

*Always:*
- **Enable Editing** / **Disable Editing**
- **Undo** / **Redo** (while editing)
- **Toggle Color Theme**
- **Reload Pathway Diagram**
- **Edit/Create PathwayDiagram**

*Conditionally:*
- On a reaction edge: **Add Edge Point**, **Remove Reaction**, **Enable/Disable Edge Editing**
- **Add Flow Line** / (on a flow line) **Add Edge Point**, **Remove Flow Line**
- **Unlock Diagram** (when you hold the lock)
- **Resize** / **Disable Resizing** (nodes/compartments)
- **Delete Compartment**, **Insert Compartment**
- **Remove Edge Point**
- On a pathway node: **Delete Pathway** (when deletable), **Go to Pathway**
- With multiple nodes selected: **Align Centers Vertically**, **Align Centers Horizontally**
- **Upload Diagram** (when there are unsaved edits)

**Before you can edit** a diagram, you must commit any staged Event / PhysicalEntity / Regulation / CatalystActivity / PathwayDiagram instances (you'll get an info dialog otherwise), and a PathwayDiagram instance must exist. Editing acquires a **lock**; if someone else holds it, you'll see a "locked" dialog.

**Open/Create PathwayDiagram (duplicate-safe):** **Edit/Create PathwayDiagram** first checks whether a PathwayDiagram already exists for the pathway. If so, it **opens the existing one** (preventing accidental duplicates); if not, it **creates a new** PathwayDiagram (named *"Diagram of {pathway}"*) and opens it.

**Uploading diagram changes:** **Upload Diagram** shows a spinner while uploading and reports success/failure via an info dialog (and requires a default person). Actions that would discard unsaved edits (reload, unlock, go-to-pathway, disable editing) first prompt with an **"Unsaved Changes"** dialog offering **Cancel / No (discard) / Yes (upload)**. The diagram also auto-backs-up periodically and on navigation.

#### Undo / Redo

While editing, most edits push an undo step: adding/removing an edge point, deleting a reaction or flow line, adding a flow line or event, deleting/inserting a compartment, deleting a pathway node, aligning centers, and moving or resizing a node/compartment (one step per drag gesture, not per pixel moved). Use the toolbar's **Undo**/**Redo** buttons, the right-click menu, or the keyboard shortcuts below. The history is per editing session — it resets whenever the diagram is (re)loaded (opening editing, reloading, or a cross-tab sync from another window).

#### Compartment resizing

Clicking **Resize** on a compartment or PE node shows four corner drag handles; drag one to resize, or click **Disable Resizing** to remove them. If handles are ever left showing with no reachable **Disable Resizing** action (e.g. after reloading an older backup), use the toolbar's **Disable All Resizing** button — it clears every resize handle in the diagram in one click regardless of which compartment it belongs to. Resize handles are also now excluded from backups/uploads/undo snapshots so this situation shouldn't recur.

### 10.5 Instance editor in Event View

The lower panel is the same [instance editor](#9-instance-editor) described above, with history (breadcrumb) enabled and edits kept local to the session. Edits propagate live: renaming, changing `hasEvent`, or toggling `doRelease` updates the tree and diagram immediately. In-place DB comparison stays in Event View; **compare two instances** hands off to a Schema View comparison route.

---

## 11) Gene2Path app

Gene2Path (`/gene2path`, opens in a new tab, no login required) uses LLM services to help annotate a gene against Reactome pathways.

**Title:** *"Gene2Path: Use LLM to Annotate a Gene in Reactome"*.

### Basic usage

1. In **"Enter a gene:"**, type a gene symbol (a default is prefilled).
2. Click **Submit** (`publish` icon, tooltip **"Submit gene for processing"**).
3. Optionally open **Settings** (`settings` icon, tooltip **"Edit Configurations"**) before submitting.

An **indeterminate progress bar** shows while the query runs.

### Settings / configuration

- **Choose Interaction Source** — **"IntAct & BioGrid Protein-Protein Interactions"** (default) or **"Reactome Functional Interactions"**.
- **Filter PPIs based on Reactome FIs** (checkbox, default on; only with IntAct & BioGrid).
- **Functional Interaction Score ≥** (0–0.9, default 0.8)
- **Top Pubmed Results:** (default 8)
- **Pathway Similarity Cutoff:** (0–0.9, default 0.20)
- **LLM Score Cutoff:** (default 3)
- **Top Pathways:** (0–20, default 8)
- **FDR: <** (1, 0.05, 0.01, 0.001, 0.0001, 0.00001; default 0.01)
- **Reset** (`refresh`) restores defaults.

### Output

Results appear with a left **navigation menu** (smooth-scrolls to sections) and content cards:

- **Annotated Pathways** — **Summary** and **Details** (pathways the gene is already annotated in).
- **Predicted Pathways** — **Summary** and **Details**. Each predicted item shows *"PMID: … vs PATHWAY: …"* with a Semantic Score, LLM Score, and Pathway FDR. An expandable **"Click to process the full text paper"** panel extracts relationships and source text; if the PDF isn't found, you can upload one (**Choose a File**).
- **Protein-Protein Interactions Supporting Annotation** — per-pathway tables with columns **Interaction Partner** and **PMID** (PubMed links), plus a summary.

Failures show under a **"Failure"** heading.

> Gene2Path does **not** write to the curation database. Generated text links out to reactome.org and PubMed. Treat all output as curation assistance requiring review.

---

## 12) Paper2Path app

Paper2Path (`/paper2path`, opens in a new tab, **login required**) runs a multi-agent (CrewAI) literature-annotation workflow and can register the results into Schema View.

> **Experimental:** *"Paper2Path is under active development. Results may be incomplete or inaccurate. Do not use for production curation without review."*

**Banner:** *"Paper2Path — Multi-Agent Literature Annotation · Powered by CrewAI"*.

### Configuration (**Configure** / **Hide Config** toggle)

- **Max Papers** (1–20, default 8)
- **Quality Threshold** (0–1, default 0.7)
- **Enable Full Text Analysis** (default on) — process full PDFs vs. abstracts only
- **Enable Literature Search** (default off) — search PubMed for more papers (requires a target gene)
- **Agent Dashboard Controls** — enable/disable **Execution Phases**, **Agents**, and per-agent **Tools** (all server-driven; all enabled by default)

### Run an annotation job

Under **Annotation**:

1. Optionally enter a **Target Gene** (e.g. `NTN1`) — you can annotate by gene alone or combine with papers.
2. Choose a source tab:
   - **Enter Papers** — add **PMID** fields (**Add PMID** / remove) and/or upload a PDF named `PMID.pdf` (**Select PDF File**).
   - **Preloaded Papers** — pick from papers already on the server (each shows PMID, size, title, and a PDF-available/not-found status icon).
   - **Results** — enabled once a job/result exists.
3. Click **Start Annotation** (`send`; disabled until at least one PMID, a selected preloaded paper, or a target gene is provided). It shows **"Processing…"** while running; **Clear** resets.

### Review results (Results tab)

- **Processing Annotation…** shows Job ID, Status, Gene, and Current Phase with a progress bar.
- **CrewAI Runtime Logs** stream live (timestamp, colored status tag, phase, summary/detail).
- On failure: **Annotation Failed** with **Try Again** / **Dismiss**.
- On success: **Annotation Complete** shows the JSON result and action buttons:
  - **Download Results** (`download`) — saves `paper2path-results-YYYY-MM-DD.json`.
  - **Add to Schema View** (`add_circle`, tooltip *"Register annotated entities, reactions and pathways as new instances in the schema view"*).
  - **New Annotation** (`refresh`) — resets.

### Register results into Schema View

**Add to Schema View** parses the result and creates new staged instances — LiteratureReferences (from PMIDs, auto-filled server-side), entities (default `EntityWithAccessionedSequence`), output Complexes, Reactions, and Pathways — then shows a snackbar (**"N instances added to schema view."**) and opens **Schema View in a new tab**. These are **staged** instances: review and validate them in Schema View, then commit. Paper2Path does not write to the database directly.

*(On first load, a bundled sample result is shown so the Results tab has example output before you run a real job.)*

---

## 13) Help panel and guided tours

### Floating help panel

A round **help** button (`help_outline`, tooltip **"Open help"** / **"Close help"**) floats over the AI apps. It opens a context-sensitive drawer — **"Gene2Path Help"** or **"Paper2Path Help"** — with usage/reviewing sections and a footer link **"Open full Tutorial page"** (→ `/tutorial`).

### Tutorial page

The **Tutorial** (`/tutorial`) has a header, a row of **Launch interactive tour** buttons (Schema View, Event View, Gene2Path, Paper2Path), and tabbed reference content: **Getting Started**, **Schema View**, **Event View**, **Gene2Path**, **Paper2Path**, **Keyboard Shortcuts**, and **Workflows**.

### Guided tour overlay

A tour highlights UI elements step by step. The step card shows **"Step X / N"**, a progress bar, navigation dots, **Back** / **Next** (**Finish** on the last step), and an **End tour** (`close`) button.

> Launching the Schema/Event/Paper2Path tours while logged out will redirect you to login (those routes are protected).

---

## 14) Keyboard shortcuts

**Attribute editing**

| Key | Context | Action |
|---|---|---|
| `Enter` | Text / number field | Commit the current edit |
| `Ctrl+Enter` / `⌘+Enter` | Text area | Insert a newline at the cursor |

**Search & list**

| Key | Context | Action |
|---|---|---|
| `Enter` | Simple search box | Run the search |
| `Enter` | Advanced-search condition | Add another condition |
| `Ctrl+Enter` | Advanced-search condition | Complete and run the search |
| `Enter` | Event-tree filter | Apply the name / dbId filter |
| `Shift+Click` | Event-tree release flag | Toggle release for the event **and all children** |

**Pathway diagram editing**

| Key | Action |
|---|---|
| `Ctrl+Z` / `⌘+Z` | Undo |
| `Ctrl+Shift+Z` / `⌘+Shift+Z` / `Ctrl+Y` | Redo |

**Guided tour**

| Key | Action |
|---|---|
| `→` | Next step |
| `←` | Previous step |
| `Esc` | End the tour |

---

## 15) Common workflows

### A) Create and commit a new instance

1. In **Schema View**, click the **Add** icon next to a class in the tree.
2. Edit attributes in the instance editor.
3. Open the staged panel from the status bar.
4. In **New Instances**, select the instance and click **commit** (`upload`).
5. If matches are found, use the **"Matches Found"** dialog to resolve each one — choose **Do Nothing**, **Commit as a new instance**, **Use a DB instance instead**, or **Merge into a DB instance**, then **Apply**.

### B) Edit existing instances and review diffs

1. Open a class instance list and open an instance.
2. Edit fields (use the **compare** toggle and **referrers** as needed).
3. Review changes in **Updated Instances** (they open in comparison view).
4. Commit selected, or **undo** to reset.

### C) Delete with safety checks

1. Open an instance and click **Delete**.
2. Review the deletion dialog and referrers warning; confirm.
3. Commit the deletion from **Deleted Instances**. (Database instances are only removed after commit.)

### D) Batch-edit an attribute across many instances

1. In a list, select the target rows.
2. Click **Batch Edit** and pick the attribute and action.
3. For replace/delete, pick which existing values to target.
4. Review the summary; commit the resulting Updated Instances.

### E) Work in Event View with tree, diagram, and editor

1. Open **Event View**; narrow the tree with the species dropdown and filter box.
2. Click an event to load it into the editor.
3. Focus, add to diagram, or create an empty diagram as needed.
4. Select diagram objects to load related instances.
5. Enable diagram editing (commit prerequisite instances first), make changes (use **Undo**/**Redo** as needed), then **Upload Diagram**.
6. Commit staged instance changes from the status toolbar.

### F) Use bookmarks for fast assignment

1. Bookmark instances you reuse (from a list row or the editor toolbar).
2. Open the **BOOKMARKS** strip.
3. Drag a bookmark onto a compatible attribute slot (green = valid) to set/add it.

### G) Change an instance's schema class

1. Open the instance and click the **expand** (`more_horiz`) button in the editor toolbar.
2. Click **change schema class** (`swap_horiz`) to open the **Change Schema Class** dialog.
3. Pick a **New schema class**. WebBench checks every referrer against the new class.
4. If any referrer would no longer accept the instance, resolve or remove those references first (open each offending referrer in a new tab from the list), then reopen the dialog.
5. When the class is conflict-free, click **Change Class**. The dbId is kept and shared attribute values are preserved; commit the resulting Updated Instance.

### H) Set stoichiometry on a multivalued value

1. In the editor, add the same instance to an `input`/`output`/`hasComponent`/`repeatedUnit` attribute as many times as needed, **or** add it once.
2. Click the **`{n} ×`** chip on the value (or choose **Stoichiometry** from its action menu).
3. Enter the **Number of copies** and click **OK**; commit the resulting change.

---

## 16) Tips and troubleshooting

- If you see the **"too many staged instances"** warning (over 200), commit staged work before continuing — batch edit is blocked until you do.
- Use **advanced search** for attribute-level filtering; use simple search for quick name/dbId lookups.
- Diagram editing requires committing staged Event/PhysicalEntity/Regulation/CatalystActivity/PathwayDiagram instances first, and a default person must be set to upload.
- If a diagram is locked by someone else, you cannot edit it until the lock is released.
- Gene2Path and Paper2Path output is **curation assistance** — always review before committing.
- If list actions feel out of sync after major changes, re-open the class list.
- Use the **Report bug** (`bug_report`) button in the status toolbar to file issues.

---

## 17) Quick URL reference

- Login: `/login`
- Home: `/home`
- Schema View root: `/schema_view`
- Event View root: `/event_view`
- Gene2Path: `/gene2path`
- Paper2Path: `/paper2path`
- Tutorial: `/tutorial`
- Class attributes: `/schema_view/class/{ClassName}`
- DB list by class: `/schema_view/list_instances/{ClassName}`
- Staged list by class: `/schema_view/local_list_instances/{ClassName}`
- Instance view: `/schema_view/instance/{dbId}`
- Event instance view: `/event_view/instance/{dbId}`

---

*This guide can later be split into role-based variants (e.g. "new curator quick start" vs. "advanced curator workflows").*
