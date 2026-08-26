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
