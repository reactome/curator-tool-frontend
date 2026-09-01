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

Last scan: 2026-08-26. Sources: inline `TODO` tags under `src/`, plus `TODO:`-prefixed items in
[docs/TODO.md](docs/TODO.md) (that file remains the source of truth for curator-reported items; this
list is the working checklist). Line numbers drift — re-grep before starting an item.

### A. Known bugs called out in code

- [x] `instance-list-view.component.ts:742` — "this is a bug, will never check the null case". Fixed 2026-08-26 on branch `fix/local-advanced-search-null-operands`. The commented-out `if (value == null) return;` would have broken `IS NULL`; the real defect was that a missing value fell through to a comparison against `''`, so `Not Equal` / `Contains` / `Regex` matched instances with no value at all, unlike the server's `IS NOT NULL AND ...` clauses. Also aligned `Not Equal` over a multi-valued attribute with the server's `NONE()`, and replaced the subscribe-into-a-local read of attribute values (which saw `undefined` whenever `fetchInstance` was asynchronous) with `forkJoin`. 7 specs added.
- [x] `instance-table.component.ts:251` — "if there is only one value in an attribute, delete this value will disable the action menu popup". **Was already fixed in 2024**; only the comment survived. Closed 2026-08-26 on branch `fix/stale-action-menu-todo-empty-slot-guard`. Written 2024-04-15 (7cf06e84); the empty-slot right-click target is an empty `<span>` that collapsed to zero height, so the slot left behind by the deleted value could not be right-clicked. Uncommenting `height: 20px` on `.span-menu-trigger` fixed it on 2024-04-23 (5c3817ca). Verified by removing that line and watching the new guard fail (`Expected 0 to be greater than 0`). Removed the stale TODO and the dead `private newMap: any` field it was stranded above; added 6 specs pinning the empty slot's hit area and menu.
- [ ] `instance-table.component.ts:448` — adding a new value resets the scroll position.
- [ ] `instance-view.component.ts:637` — add-then-delete of a new attribute value needs better tracking.
- [ ] `pathway-diagram-validator.ts:120` — in editing mode an attribute may map to more than one element.
- [ ] `hyperedge.ts:536` — unresolved: should `outputEdge` or `inputEdge` data be used?
- [ ] `hyperedge.ts:404` — edge-point node checking not finished.
- [ ] `instance-converter.ts:33` — compartment text not selectable when the compartment is created first.
- [ ] `pathway-diagram-utils.ts:87` — compartment label offset from the original label.
- [ ] `event-tree.component.ts:61` — `node.attributes` typed as `Object`, not `Map` (typing bug).

### B. Refactors / cleanup

- [ ] `data.service.ts:343` — multiple redundant rounds of instance loading across `DataService` and `InstanceUtilities`.
- [ ] `data.service.ts:1309` — split instance/attribute logic out of `DataService` into its own service.
- [ ] `data.service.ts:971` — persist only changed attributes for updated instances (performance).
- [ ] `data.service.ts:36` — move URL construction to an Angular ConfigService.
- [ ] `text-curation.component.ts:185` — code copied from `schema-class-tree.component.ts`; extract a shared service.
- [ ] Shared: `action-menu.component.ts` is triplicated (instance-table row element, batch-edit attribute-edit, qa-reports) — refactor into one generic menu.
- [ ] `bread-crumb.component.ts:4` — manage breadcrumb state in NgRx instead of ad hoc.
- [ ] `instance-list-view.component.ts:831` — move helper into `InstanceUtilities`.
- [ ] `instance-list-view.component.ts:867` — `take(1)` vs. re-subscribe needs a decision.
- [ ] `pathway-diagram.component.ts:258` — drop the `reason` param, rename to `backupEditedDiagram`.
- [ ] `hyperedge.ts:114` / TODO.md — replace the aStar hack for all-paths-between-two-nodes.
- [ ] `InstanceNameGenerator.ts:10` — ensure it is a singleton; `:313` — untested code path.
- [ ] `user-instances.service.ts:58` — load via `APP_INITIALIZER`, like the schema tree; `:69` — value must be updated at deployment.
- [ ] `instance.effects.ts:342` — decide whether `handleInstanceAttributes()` is needed here; `:139` — check whether that block is needed at all.
- [ ] `instance-view.component.ts:49` — derive from `dbInstance` instead of `showReferenceColumn`; `:429` — verify the `resetCache && dbId >= 0` guard has no side effects; `:963` — schema view is hardcoded as the back target.
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
- [ ] `referrers-table.component.ts:53` — omit instances marked for deletion from the referrer list.
- [ ] `instance-view.component.ts:706` — show a confirmation dialog when the operation completes.
- [ ] `local-instance-list.component.ts:440` — emit the collected list back to the table.
- [ ] `batch-edit-dialog.component.ts:243` — collect values selected in the aggregated-attributes dialog; `:610` — display-name update on batch edit unfinished.
- [ ] `schema-class-table.component.ts:21` — richer table display.
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
- [ ] `main-event.component.ts:20` — size the table as a ratio of the window instead of a fixed size; `:185` — pick a default pathway for the diagram when nothing is selected.
- [ ] `pathway-diagram-utils.ts:781` / `:789` — node sizes to be determined; add a CSS class for resizing.
- [ ] `instance-converter.ts:291` — compute node size to wrap all text.
- [ ] `editor-actions.component.html:12` — possibly check all objects related to an object-specific reaction.

### E. Pathway diagram behavior (from TODO.md)

- [ ] Remove a reaction from the diagram when the reaction is marked for deletion (likely needs a validation step, as in the Java tool).
- [ ] Disable dragging of nodes/edges in the diagram legend.
- [ ] Allow diagram edits without a lock, but block committing them without one.
- [ ] Resetting an input/output change does not reset the demoted review status, and `structureChanged` stays stuck.

### F. Auth (from TODO.md)

- [ ] Let users change their password; expire generated passwords after first use.
- [ ] Support special characters (`@#$%&*`) in passwords (lowest priority).

Excluded from the list: `custom-theme.scss:17` is an Angular Material scaffold comment, not our work.

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
