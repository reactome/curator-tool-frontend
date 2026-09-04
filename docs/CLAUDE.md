# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


# Project Task Management Protocol

## TODO Management Rules
- You are responsible for scanning the codebase for `// TODO`, `# TODO`, or `<!-- TODO -->` tags.
- Maintain a centralized checklist in the "Active TODO List" section below.
- Before starting any development task, ask to review the current active items.
- Automatically update this file, marking tasks as completed `[x]` once your generated code passes or the goal is met.
- Please generate a pull request for each solved TODO so we may review before adding to main.

## Active TODO List

Last scan: 2026-09-01. Sources: every inline `TODO`/`FIXME` tag under `src/` (58 hits), plus **every
item** in [docs/TODO.md](docs/TODO.md) — not only the `TODO:`-prefixed lines, which is what the
2026-08-26 scan covered. [docs/TODO.md](docs/TODO.md) remains the source of truth for
curator-reported items and keeps their original wording; this list is the working checklist and
paraphrases them. Priority notes from TODO.md ("low priority", "high important", "most important")
are carried over verbatim, since they are the curators' own triage. Line numbers drift — re-grep
before starting an item.

### A. Known bugs

#### Called out in code

- [x] `instance-list-view.component.ts:742` — "this is a bug, will never check the null case". Fixed 2026-08-26 on branch `fix/local-advanced-search-null-operands`. The commented-out `if (value == null) return;` would have broken `IS NULL`; the real defect was that a missing value fell through to a comparison against `''`, so `Not Equal` / `Contains` / `Regex` matched instances with no value at all, unlike the server's `IS NOT NULL AND ...` clauses. Also aligned `Not Equal` over a multi-valued attribute with the server's `NONE()`, and replaced the subscribe-into-a-local read of attribute values (which saw `undefined` whenever `fetchInstance` was asynchronous) with `forkJoin`. 7 specs added.
- [x] `instance-table.component.ts:251` — "if there is only one value in an attribute, delete this value will disable the action menu popup". **Was already fixed in 2024**; only the comment survived. Closed 2026-08-26 on branch `fix/stale-action-menu-todo-empty-slot-guard`. Written 2024-04-15 (7cf06e84); the empty-slot right-click target is an empty `<span>` that collapsed to zero height, so the slot left behind by the deleted value could not be right-clicked. Uncommenting `height: 20px` on `.span-menu-trigger` fixed it on 2024-04-23 (5c3817ca). Verified by removing that line and watching the new guard fail (`Expected 0 to be greater than 0`). Removed the stale TODO and the dead `private newMap: any` field it was stranded above; added 6 specs pinning the empty slot's hit area and menu.
- [x] `instance-table.component.ts:443` — adding a new value resets the scroll position. Fixed
      2026-09-04; 4 specs in `instance-view-scroll.spec.ts`. Two independent causes, and the second
      one is only observable in the real app — **do not trust a `fakeAsync` spec here**, it says the
      scroll survives when in the browser it does not:
    1. `updateTableContent()` assigned a **new** `DataSource` every time. CdkTable then diffs a
       brand-new row set, and `_DisposeViewRepeaterStrategy` destroys all ~100 rows before
       re-inserting them; tearing down that many `mat-form-field`/tooltip/ripple rows forces a
       layout while `<tbody>` is empty, so the browser clamps `.table-container.scrollTop` to 0.
       Confirmed from a live `[scroll-diag]` trace: a `scroll` event `1845 -> 0` two ms after
       `finishEdit`, with **no** stack (so not a programmatic write, `focus()` or `scrollIntoView()`)
       and `scrollHeight` unchanged at 2588 (so not a permanent height collapse). Both data sources
       now push rows through a `BehaviorSubject` and expose `refresh()`, and the table has
       `[trackBy]="trackByAttributeName"`, so an edit updates the affected rows in place.
       Consequence to remember: rows are keyed on attribute name only, so two instances of the same
       class reuse each other's rows — a *switch* no longer resets the scroll as a side effect, which
       is why `updateTableContent` sets `scrollTop = 0` explicitly when `renderedDbId` changes.
    2. `InstanceViewComponent`'s template guards `app-instance-table` with
       `*ngIf="!showProgressSpinner && instance"`, and a post-edit notification (`refreshViewDbId$` /
       `lastUpdatedInstance$` — the `inEditing` guards there only cover the synchronous part of
       `finishEdit`, so an async post-edit callback slips past them) reloads the instance already on
       display via `loadInstance(…, forceReload)`, which raised the spinner unconditionally. Once the
       re-fetch takes a tick that unmounts the scrolling element and remounts it at the top, and it
       left `this.instanceTable` undefined, which `_loadIntance` dereferenced (`TypeError: Cannot
       read properties of undefined`). Same-dbId non-comparison reloads are now refreshes in place.
- [ ] `instance-view.component.ts:640` — add-then-delete of a new attribute value needs better tracking.
- [ ] `pathway-diagram-validator.ts:120` — in editing mode an attribute may map to more than one element.
- [ ] `hyperedge.ts:536` — unresolved: should `outputEdge` or `inputEdge` data be used?
- [ ] `hyperedge.ts:404` — edge-point node checking not finished; `:419` — no known use cases yet.
- [ ] `instance-converter.ts:33` — compartment text not selectable when the compartment is created first.
- [ ] `pathway-diagram-utils.ts:87` — compartment label offset from the original label.
- [ ] `event-tree.component.ts:61` — `node.attributes` typed as `Object`, not `Map` (typing bug).

#### From docs/TODO.md (non-diagram; diagram bugs are in section E)

- [ ] **Server side** — PubMed records whose author is an organization return a null author name, e.g.
      "UK10K" in https://pubmed.ncbi.nlm.nih.gov/23872636/. Fix belongs in `curator-tool-ws`.
- [ ] Comparison mode: turning it off and selecting comparison again uses the database version instead
      of the instance previously compared against.
- [ ] Duplicate pathway diagrams are not checked on commit — two users can each create a diagram for
      the same pathway and both commit, producing duplicate PathwayDiagram instances.
- [ ] LLM text generation leaves the `[PMID: 123456]` template unreplaced (seen for ALDOB). See
      Peter's email, 2024-11-13.
- [ ] Autoscroll in the event view scrolls the whole instance view; it should scroll only the table
      content, as the schema view does. (Partially fixed, not yet ideal.)
- [ ] *Low priority* — in the event view the mouse position is offset low while scrolling the
      instance view up/down.
- [ ] *Low priority, judged hard to fix* — listing InstanceEdit and typing `2025` in the search box
      returns nothing, while advanced search on `DisplayName contains 2025` returns instances.
- [x] **Fixed; kept for regression testing.** A PE used as both input and catalyst lost the input or
      the catalyst when diagram editing was toggled off and on:
      `http://localhost:4200/event_view/instance/453279?select=8848436`.

### B. Refactors / cleanup

- [ ] `data.service.ts:414` — multiple redundant rounds of instance loading across `DataService` and `InstanceUtilities`.
- [ ] `data.service.ts:1492` — split instance/attribute logic out of `DataService` into its own service.
- [ ] `data.service.ts:1154` — persist only changed attributes for updated instances (performance).
- [ ] `data.service.ts:37` — move URL construction to an Angular ConfigService.
- [ ] `text-curation.component.ts:195` — code copied from `schema-class-tree.component.ts`; extract a shared service; `:154` — the injected customization point is hardcoded.
- [ ] Shared: `action-menu.component.ts` is triplicated (instance-table row element, batch-edit attribute-edit, qa-reports) — refactor into one generic menu.
- [ ] `bread-crumb.component.ts:4` — manage breadcrumb state in NgRx instead of ad hoc.
- [ ] `instance-list-view.component.ts:861` — move helper into `InstanceUtilities`.
- [ ] `instance-list-view.component.ts:897` — `take(1)` vs. re-subscribe needs a decision.
- [ ] `pathway-diagram.component.ts:262` — drop the `reason` param, rename to `backupEditedDiagram`.
- [ ] `hyperedge.ts:114` / TODO.md — replace the aStar hack for all-paths-between-two-nodes.
- [ ] `InstanceNameGenerator.ts:10` — ensure it is a singleton; `:313` — untested code path.
- [ ] `user-instances.service.ts:58` — load via `APP_INITIALIZER`, like the schema tree; `:69` — value must be updated at deployment.
- [ ] `instance.effects.ts:342` — decide whether `handleInstanceAttributes()` is needed here; `:139` — check whether that block is needed at all.
- [ ] `instance-view.component.ts:50` — derive from `dbInstance` instead of `showReferenceColumn`; `:431` — verify the `resetCache && dbId >= 0` guard has no side effects; `:970` — schema view is hardcoded as the back target.
- [ ] TODO.md — audit every component for unsubscribed subscriptions on destroy; use `take(1)` or explicit teardown for `DataService` query subscriptions.

### C. Features / enhancements (front end)

- [ ] TODO.md — action on attribute-table links to open the referred instance in a new tab/window; make the reference table clickable the same way.
- [ ] TODO.md — list a curator's updated + newly committed instances over a chosen time range (day / week / custom).
- [ ] TODO.md — port the preceding/following Event inference feature from the Java version.
- [ ] TODO.md — batch creation of instances from a list (PubMed IDs → LiteratureReference, UniProt → EWAS).
- [ ] TODO.md — regex-based text search.
- [ ] TODO.md — sticky/persisted attribute-table sort option, applied to subsequently opened tables.
- [ ] TODO.md — demote review status when `structureModified` is newer than `reviewed`/`internalReviewed`; give InstanceEdit shell instances a `dateTime` attribute.
- [ ] TODO.md — refresh the displayed stable identifier after a species change (server side already correct).
- [ ] TODO.md — post-processing for UniProt, ChEBI, external ontology (ReferenceMolecule).
- [ ] TODO.md — add a circular-reference check for the event tree / `precedingEvent` (flagged high importance).
- [ ] TODO.md — deleted-instance generated display name.
- [ ] TODO.md — add an InstanceEdit to referrers of a deleted instance and merge it into locally loaded referrers.
- [ ] TODO.md, **flagged most important** — write privileges on log-in: decide and implement how they
      are granted and enforced.
- [ ] TODO.md — offer `curatorComments` and a replacement-instance picker directly on the deletion
      confirmation modal, to encourage populating those fields. (An attribute list is stranded under
      this item in TODO.md — see section I.)
- [ ] TODO.md — MCP server / interface for staged instances.
- [ ] TODO.md — let a curator view only one pathway's related instances (Karen's request).
- [ ] TODO.md — customized view for Figure instances that displays the figure.
- [ ] TODO.md — triage the demo feedback from Eliot and others, 2026-03-16:
      https://docs.google.com/document/d/1zlj3KKDwRQYUBCGIi4P3uqsb5X3JRfk8WoOqj2BXssI/edit?tab=t.0#heading=h.y6ik0la1wydu
- [ ] `referrers-table.component.ts:53` — omit instances marked for deletion from the referrer list.
- [ ] `instance-view.component.ts:709` — show a confirmation dialog when the operation completes.
- [ ] `local-instance-list.component.ts:440` — emit the collected list back to the table.
- [ ] `batch-edit-dialog.component.ts:243` — collect values selected in the aggregated-attributes dialog; `:610` — display-name update on batch edit unfinished.
- [ ] `schema-class-table.component.ts:22` — richer table display.
- [ ] `bookmark-list.component.ts:39` — bookmark behavior is confusing; needs a design decision.
- [ ] `status.component.html:76` — placeholder marked "to be implemented soon".
- [ ] `instance-table-row-element.component.html:56` — also determine required/disabled state.
- [ ] `instance-list-table.component.html:78` — build the tooltip in the component instead of the template.
- [ ] `new-instance-dialog.component.html:5` — verify touch works for the `click` event; `:12` — convert to a case statement.
- [ ] `instance.service.ts:1080` — open question for Guanming: merging passive edits into the event tree.

### D. UI / styling

- [ ] TODO.md — Boolean sliders read as `false` when they are `true` but disabled (gray styling).
- [ ] TODO.md — event-tree icons are black and invisible in dark mode.
- [ ] TODO.md — adopt the new Reactome icon set from Figma (EBI design; confirm with Eliott).
- [ ] `styles.scss:15` — choose custom styles; `:51` — replace the hardcoded `min-height: 12px` with a calculation.
- [ ] `main-event.component.ts:22` — size the table as a ratio of the window instead of a fixed size; `:206` — pick a default pathway for the diagram when nothing is selected.
- [ ] `pathway-diagram-utils.ts:781` / `:789` — node sizes to be determined; add a CSS class for resizing.
- [ ] `instance-converter.ts:291` — compute node size to wrap all text.
- [ ] `editor-actions.component.html:12` — possibly check all objects related to an object-specific reaction.
- [ ] `main-schema-view.component.html:22` — "fix the dragging after the SAB". *(Missed by the
      2026-08-26 scan.)*
- [ ] `instance-table-row-element.component.scss:5` and
      `batch-edit-dialog/attribute-edit/attribute-edit.component.scss:5` — the same "make sure this is
      the same height as the link in other cells" TODO, duplicated in both files. *(Missed by the
      2026-08-26 scan.)* Both sit beside the `height: 20px` rule whose history is documented in the
      closed `instance-table.component.ts:251` item above — read that before changing either.

### E. Pathway diagram (from docs/TODO.md)

#### Bugs

- [ ] Compartment layer ordering is effectively random, so some compartments cannot be selected —
      e.g. the nested compartments in `http://localhost:4200/event_view/instance/157858`. Caused by the
      order in which compartments are plotted. (Listed twice in TODO.md; merged here.)
- [ ] The diagram for `http://localhost:4200/event_view/instance/6787011` does not appear until editing
      is enabled, and disappears again when editing is disabled. These are all rice pathways; some of
      their reactions have no inputs or outputs, the converter drops the hanging ends, and then the
      backbone no longer matches the position points and the conversion errors out. The converter
      should run cleanly for every pathway diagram.
- [ ] Rounded edges become square after enabling editing on
      `http://localhost:4200/event_view/instance/397014`; only a page refresh restores them.
- [ ] Resizing a node does not change the height of the selection background — though sometimes it
      does work.
- [ ] Inner shapes are not updated when nodes are resized.
- [ ] Connecting positions are not updated for helper nodes when they are dragged during editing.
- [ ] A newly added compartment drags too fast, probably from a stale previous drag position.
- [ ] "Go to pathway" in the diagram sometimes selects oddly — the selected pathway gets stuck in the
      URL.
- [ ] Empty reactions cannot be deleted or edited in the pathway diagram.

#### Behavior / unimplemented

- [ ] Remove a reaction from the diagram when the reaction is marked for deletion (likely needs a validation step, as in the Java tool).
- [ ] The converse: deleting a reaction in the diagram should delete that reaction instance, and the
      same for other objects (e.g. a PE linked to a reaction).
- [ ] Disable dragging of nodes/edges in the diagram legend.
- [ ] Allow diagram edits without a lock, but block committing them without one.
- [ ] Resetting an input/output change does not reset the demoted review status, and `structureChanged` stays stuck.
- [ ] Stoichiometry is not yet updated when the diagram is refreshed after instance editing.
- [ ] Central management of compartment ids — the same compartment can be added several times.
- [ ] Allow moving the inner part of a compartment during diagram editing. *(Low priority.)*

### F. Auth (from TODO.md)

- [ ] Let users change their password; expire generated passwords after first use.
- [ ] Support special characters (`@#$%&*`) in passwords (lowest priority). TODO.md also reports this
      as a bug ("special characters cannot work in the password") — same work.

### G. Testing / QA (from TODO.md)

- [ ] Walk through the event view on the dev environment: create a new event, add a new subpathway,
      create a new diagram for an event.
- [ ] QA check for a staged instance, per the Reactome team meeting of 8/4 (2025).

### H. Documentation (from TODO.md)

- [ ] Move the deletion-behavior specification at the bottom of [docs/TODO.md](docs/TODO.md) into a
      proper test-case document under `docs/`. It enumerates the expected behavior of local deletion
      vs. committed deletion (store lists, cache, schema-tree counts, page counts, referrer
      InstanceEdits) and ends with an open question — step 5.4 needs the server to return the referrer
      list on update, because referrers may be cached in the front end. That server change pairs with
      the section C item on merging a deleted instance's InstanceEdit into loaded referrers.

### I. Unclear — needs the author's clarification

- [ ] TODO.md — "bug when adding golgi apparatus to the inst": the line is truncated, and there is no
      instance or step to reproduce from.
- [ ] TODO.md — a bare list of attribute names sits under the deletion-modal item: `HasMember`,
      `HasCandidate`, `HasComponent`, `HasComponentForComplex`, `HasModifiedResidue`, `Input`,
      `InputForReactionLikeEvent`, `RepeatedUnit`, `RepeatedUnitForPhysicalEntity`. These are the
      stoichiometry-bearing relationship types, but what was intended for them is not recorded.

### Excluded, with reasons

- `custom-theme.scss:17` — an Angular Material scaffold comment, not our work.
- `instance-table-row-element.component.spec.ts:37` — references the closed
  `instance-table.component.ts:251` TODO in a spec docblock; it is history, not an open item.
- TODO.md's deletion-confirmation `NOTE` (dated 10/24/25) records a **decision already taken**: keep
  the first dialog with "no referrers to show" rather than fetching referrers up front to choose which
  dialog to show, because getting referrers is a heavy transaction. Do not "fix" this.

## What this is

The Angular front end of the Reactome **Curator Tool / WebBench** — a web port of the Java desktop
CuratorTool. Curators browse the Reactome schema, edit instances, and commit them to a Neo4j-backed
database through a separate Spring Boot backend (`https://github.com/reactome/curator-tool-ws`,
checked out locally at `/Users/beaversd/IdeaProjects/curator-tool-ws`). Features often span both
repos — a change to search, operands, or query parameters here usually has a counterpart there.

Angular 17, NgModule-based (not standalone), NgRx 17, Angular Material, Karma/Jasmine.

## Commands

```bash
npm start                              # ng serve → http://localhost:4200 (expects backend on :9090)
npx ng build                           # local production build only (see the npm run build warning)
npx ng build --configuration development
npm test                               # ng test, watch mode
```

Headless single run (Chrome path must be set explicitly on macOS):

```bash
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx ng test --watch=false --browsers=ChromeHeadless
CHROME_BIN=... npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/core/**/*.spec.ts'
```

There is no linter configured. `tsconfig.json` is `strict` with `strictTemplates`,
`noPropertyAccessFromIndexSignature`, and `noImplicitReturns`; `skipLibCheck: true` is deliberate
(works around a langchain typing issue).

**`npm run build` does more than build.** It builds with `--base-href='/curatortool/'`, tars the
output, and `scp`s it to the `curator` host. Never run it just to check that the code compiles — use
`npx ng build`. Deployment details (base href, `.htaccess`, apache proxy config, how to unpack over
the existing folder) are in [README.md](README.md) and should be followed as written.

### Test suite baseline

The suite is red by default: roughly 68 of ~122 specs fail. Almost all are the Angular CLI's
auto-generated `should create` stubs, which call `TestBed.createComponent` without the providers or
module imports the component needs (`NullInjectorError: No provider for Store/HttpClient`,
`NG0304: '<mat-...>' is not a known element`). They have never asserted anything. **A red run does
not mean a regression** — check whether the failure is one of those stubs first.

Two gotchas: `ng test` compiles *all* specs, so one broken spec fails the whole run even with
`--include`; and importing `InstanceListViewComponent` directly from a spec throws "Cannot access
before initialization" because of a circular import through `MatchResolutionService` →
`MatchedInstancesDialogComponent` → `ListInstancesModule` (the dialog component must be imported
first, for its side effect). Real tests here use `TestBed.configureTestingModule` with
`jasmine.createSpyObj` doubles for `Store`, `MatDialog`, and the dialog services — see
[instance.service.spec.ts](src/app/core/services/instance.service.spec.ts).

## Environments

Source files import `src/environments/environment.dev.ts` **by path, directly** — including
`app.module.ts`, services, and components. The production build swaps the file via `fileReplacements`
in [angular.json](angular.json). So: always import `environment.dev`, never `environment.prod`, and
remember that editing `environment.dev.ts` changes dev *and* the shape prod must match. Dev points at
`http://localhost:9090/api/curation`; prod at the relative `/api/curation`.

`llmOn` in the dev environment gates the LLM features (Gene2Path / Paper2Path, backed by a Flask app
on port 5000).

## Local tarball dependencies

`ngx-reactome-diagram` and `ngx-reactome-cytoscape-style` are installed from **tarballs** built out of
the sibling repo `../ngx-reactome-base/dist/...`. To pick up a change there: build the widget in that
repo (`npm run build-diagram`), **bump its version**, then `npm i <path-to-tgz>` here. Without the
version bump Chrome keeps serving the old library and the change appears not to have happened.

## Architecture

### The staging model is the central concept

Nothing a curator does reaches the database until they commit. Understand this before changing
anything in `core/` or `instance/`:

- New instances get **negative dbIds**, handed out by `DataService.getNextNewDbId()` from a counter
  shared across tabs in `localStorage` and serialized with the Web Locks API.
- New / updated / deleted instances live in four NgRx entity stores (`new_instances`,
  `updated_instances`, `delete_instances`, `default_person`) keyed by dbId, holding **shell**
  instances (`InstanceUtilities.makeShell` — dbId + displayName + class, no attributes) to avoid
  duplicating and locking the real objects.
- The real, full instances live in `DataService.id2instance`, a client-side cache that is the source
  of truth for staged edits. `fetchInstance()` returns the staged version; `removeInstanceInCache()`
  is how you force a reload of the pristine database copy. `Instance.source` holds the database copy
  for comparison views.
- Staged work is persisted per user on the server (`persistInstances` / `loadInstances` /
  backups) by [UserInstancesService](src/app/auth/login/user-instances.service.ts), loaded at login,
  and capped at `MAX_STAGED_INSTANCES` (200).
- Commit (`DataService.commit`) fills referenced instances, may hold instances back for the duplicate
  check (`matchInstances` → matched-instances dialog → `MatchResolutionService`), and on success
  re-keys the negative dbId to the persisted one via `newInstOld2NewId`, which then has to be
  remapped through every cached reference (`remapNewInstanceReferenceDbId`).

`Instance.attributes` is a `Map<string, any>` in memory but a plain object on the wire. Anything
coming from HTTP or `localStorage` must go through `InstanceUtilities.handleInstanceAttributes()` /
`DataService.registerInstance()`; anything going out through `stringifyInstance()`, which also drops
`schemaClass` (it is a large cyclic graph).

### Cross-tab synchronization via localStorage

Curators work in several windows at once, and every window must see the same staged edits. The
mechanism, used in three places, is the `storage` DOM event (which fires in every tab *except* the
one that wrote):

- [instance.effects.ts](src/app/instance/state/instance.effects.ts) — every mutating action is
  written to `localStorage` under the action type by a `{dispatch: false}` effect. The receiving tab's
  `storage` listener dispatches the **`ls_`-prefixed twin** of that action; reducers handle both, but
  only the non-`ls_` one triggers a broadcast. That prefix pair is the infinite-loop guard — keep it
  when adding actions. Whole-list snapshots are written under Web Locks and deliberately *replace*
  rather than merge (see the long comment on `storeSnapshot`).
  These effects must be registered with `EffectsModule.forRoot` only — registering them per feature
  attaches the `storage` listener twice.
- [SessionSyncService](src/app/core/services/session-sync.service.ts) — the `token` key: a logout or
  a fresh login in one tab tears down or resumes all the others.
- [UserInstancesService](src/app/auth/login/user-instances.service.ts) — the `syncUserInstances` key,
  for wholesale replacement (backup restore / file import), which the per-action effects don't cover.

### InstanceUtilities is the imperative refresh bus

[instance.service.ts](src/app/core/services/instance.service.ts) (`InstanceUtilities`) sits alongside
NgRx and carries the things the store can't: RxJS `Subject`s that views subscribe to
(`refreshViewDbId$`, `lastClickedDbId$`, `lastUpdatedInstance$`, `markDeletionDbId$`,
`committedNewInstDbId$`, …), plus the `shellInstances` map so that a display name or dbId change
propagates to every place the instance is merely referenced. When a change must repaint a view, the
pattern is `setRefreshViewDbId(dbId)`, not a store selector.

### Schema-driven UI

There are no hand-written forms per class. `SchemaClass` / `SchemaAttribute`
([reactome-schema.model.ts](src/app/core/models/reactome-schema.model.ts)) are fetched from the
backend, cached in `DataService`, and the instance editor renders and validates from that metadata —
`cardinality` (`'1'` vs `'+'`), `category` (`MANDATORY`/`REQUIRED`/`NOMANUALEDIT`), `type`
(`INSTANCE` vs scalar), `allowedClases`. The schema tree is loaded at bootstrap by an
`APP_INITIALIZER` in [app.module.ts](src/app/app.module.ts), which is why `DataService.initialize()`
must fail soft: it resolves even on error so the app still starts.

### Two extension-point pipelines

Both are ordered lists that run over an instance; add to the list rather than special-casing callers.

- **Post-edit** — [PostEditService](src/app/core/services/post-edit.service.ts) runs every
  `PostEditOperation` after an attribute edit: the auto-fillers (LiteratureReference/PubMed, ChEBI,
  ReferenceSequence, ExternalOntology), then `InstanceNameGenerator` (display name generation, ported
  from the Java version — order matters, it must run after the fillers), then `ReviewStatusCheck`.
- **View filters** — `InstanceViewFilter` implementations in
  [core/instance-view-filters/](src/app/core/instance-view-filters/) run when an instance is *displayed*
  (regenerate display names, strip references to deleted instances, adjust review status). They
  operate on a copy, and they can fire `refreshViewDbId$` mid-load — a real source of races in
  `InstanceViewComponent`.

### Auth and session

JWT in `localStorage['token']`, plus an HttpOnly refresh cookie the backend owns.
[HeaderInterceptor](src/app/core/interceptors/header.interceptor.ts) adds the bearer token to
`api/curation` requests and handles 401 by retrying once with the same token (a transient
post-login race) before asking [TokenRefreshService](src/app/core/services/token-refresh.service.ts)
to refresh — refreshes take turns across tabs, because a refresh token can only be spent once.
[InactivityService](src/app/core/services/inactivity.service.ts) enforces an 18-minute idle logout
measured across *all* tabs, including time when every tab was closed. `authGuard` / `loginGuard` and
[session-url.ts](src/app/core/services/session-url.ts) remember where the curator was so login
returns them there rather than to `/home`.

### Feature areas

Lazy-loaded modules under [src/app](src/app), routed by
[app-routing.module.ts](src/app/app-routing.module.ts):

| Route | Module | Notes |
|---|---|---|
| `schema_view` | `MainSchemaViewModule` | Schema tree + child routes (`instance`, `class`, `list_instances`, `referrers`). Child routes are deliberate: they reuse one `MainSchemaViewComponent` so the tree's scroll position survives navigation. |
| `event_view` | `MainEventModule` | Event tree + pathway diagram + embedded instance editor. |
| `home`, `login`, `tutorial` | | |
| `gene2path`, `paper2path` | | LLM-backed; `gene2path` is intentionally left unguarded (the URL was cited in grant applications). |

The instance editor ([instance/components/instance-view](src/app/instance/components/instance-view))
is shared by both views and takes `isInEventView` / `blockRoute` / `needHistory` inputs to adapt.
Store feature reducers are registered from several feature modules (`instance.module.ts`,
`status.module.ts`, `list-instances.module.ts`, `instance-bookmark.module.ts`), so the same reducer
may be registered from more than one place by design.

The pathway diagram ([event-view/components/pathway-diagram](src/app/event-view/components/pathway-diagram))
wraps `ngx-reactome-diagram`/Cytoscape and converts between Reactome instances and diagram objects
(`utils/instance-converter.ts`, `utils/hyperedge.ts`, `utils/diagram-editor.service.ts`). Diagrams are
edited under a server-side lock (`DiagramLock`) with periodic auto-persist.

## Conventions

- **Comments explain bug history, at length.** Non-obvious code carries a paragraph on the symptom it
  fixed and why the obvious alternative is wrong (see `storeSnapshot`, `loginGuard`,
  `handle401Error`). Match that density when touching the same code, and don't delete such a comment
  without understanding what it is defending against.
- **[docs/changes_log.md](docs/changes_log.md) is user-facing and updated with each build.** Entries
  are prose written for curators — what changed and what they will notice, not the implementation.
  Most feature commits touch it. [docs/UserGuide.md](docs/UserGuide.md) documents every UI element and
  is updated alongside user-visible changes; [docs/TODO.md](docs/TODO.md) is the running bug/feature
  list.
- Icon names and tooltips for action buttons are centralized in `ACTION_BUTTONS` in
  [reactome-schema.model.ts](src/app/core/models/reactome-schema.model.ts).
- Component styles are SCSS; theming lives in `src/custom-theme.scss`, `src/_palette.scss`,
  `src/theme-helper.scss`.
