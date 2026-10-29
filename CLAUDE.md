# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The working TODO checklist (inline `TODO` tags plus [docs/TODO.md](docs/TODO.md)) and its
management protocol live in [docs/CLAUDE.md](docs/CLAUDE.md). Read it before picking up a bug or
feature item. It is kept out of this file because of its size.

## What this is

This is the Angular front end of the Reactome **Curator Tool / WebBench**, a web port of the Java
desktop CuratorTool. Curators browse the Reactome schema, edit instances, and commit them to a
Neo4j-backed database through a separate Spring Boot backend, `curator-tool-ws`
(https://github.com/reactome/curator-tool-ws, a sibling checkout at `../curator-tool-ws`). Features
often span both repos. A change to search, operands, or query parameters here usually has a
counterpart in the backend.

Stack: Angular 17 with NgModules (the one standalone exception is the `graph_query` page), NgRx 17,
Angular Material, and Karma/Jasmine. Node version is in [.nvmrc](.nvmrc).

## Commands

```bash
npm start                              # ng serve → http://localhost:4200 (expects backend on :9090)
npx ng build                           # local production build; use this to check compilation
npx ng build --configuration development
npm test                               # ng test, watch mode
```

Headless single run (on macOS the Chrome path must be set explicitly):

```bash
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx ng test --watch=false --browsers=ChromeHeadless
# single area:
CHROME_BIN=... npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/core/**/*.spec.ts'
```

There is no linter. [tsconfig.json](tsconfig.json) turns on `strict` and `strictTemplates`.
`skipLibCheck: true` is deliberate; it works around a langchain typing issue.

**`npm run build` deploys.** It builds with `--base-href='/curatortool/'`, tars `dist/`, and `scp`s
the tarball to `aws_curator_new`. Never run it just to check compilation; use `npx ng build`
instead. For deployment (base href, `.htaccess`, Apache proxy config, unpacking over the existing
folder), follow [README.md](README.md) as written.

### Test suite baseline

The suite is red by default. Most failures are the Angular CLI's auto-generated `should create`
stubs. They call `TestBed.createComponent` without the providers or imports the component needs, so
they fail with `NullInjectorError: No provider for Store/HttpClient` or `NG0304: '<mat-...>' is not a
known element`. Those stubs have never asserted anything. **A red run is not necessarily a
regression**, so first check whether the failing spec is one of them.

Gotchas:
- `ng test` compiles *all* specs, so one spec that doesn't compile fails the whole run, even with
  `--include`.
- Importing `InstanceListViewComponent` directly in a spec throws "Cannot access before
  initialization". The cause is a circular import: `MatchResolutionService` →
  `MatchedInstancesDialogComponent` → `ListInstancesModule`. Import the dialog component first, for
  its side effect.
- Real tests use `TestBed.configureTestingModule` with `jasmine.createSpyObj` doubles for `Store`,
  `MatDialog`, and the dialog services. See
  [instance.service.spec.ts](src/app/core/services/instance.service.spec.ts).

## Environments and services

Source files import `src/environments/environment.dev` **by path**, everywhere: `app.module.ts`,
services, and components. The production build swaps that file for `environment.prod.ts` through
`fileReplacements` in [angular.json](angular.json). Always import `environment.dev`, never
`environment.prod`. When you add a key, add it to both files.

| Key | Dev | Prod | Backs |
|---|---|---|---|
| `ApiRoot` / `authURL` | `localhost:9090/api/{curation,auth}` | `/api/...` | curator-tool-ws |
| `llmURL` | `127.0.0.1:5000` | `/llm` | Flask LLM app used by `gene2path` |
| `llmApiURL` | `localhost:8000/api/llm` | `/llm/api/llm` | curator-tool-llm (paper annotation and chat, SSE streaming) |
| `nlQueryURL` | `localhost:8095/api/nlquery` | `/api/nlquery` | NL→Cypher sidecar for `graph_query`; validates tokens against ws |
| `curatorGraphBaseUrl` | newcurator.reactome.org | same | external link |

`llmOn` exists only in the dev file, and the only code that reads it is commented out.

## Local tarball dependencies

`ngx-reactome-diagram` and `ngx-reactome-cytoscape-style` are installed from **tarballs** built in
the sibling repo `../ngx-reactome-base/dist/...`. To pick up a change from that repo:

1. Build the library there (`npm run build-diagram`).
2. **Bump its version.**
3. Run `npm i <path-to-tgz>` here.

If you skip the version bump, Chrome keeps serving the old library and the change appears not to
have happened.

## Architecture

### The staging model is the central concept

Nothing a curator does reaches the database until they commit. Understand this before you change
anything in `core/` or `instance/`:

- New instances get **negative dbIds** from `DataService.getNextNewDbId()`. The counter is shared
  across tabs in `localStorage`, and the Web Locks API serializes access to it.
- New, updated, and deleted instances live in NgRx entity stores (`new_instances`,
  `updated_instances`, `delete_instances`, `default_person`) keyed by dbId. These stores hold
  **shell** instances (`InstanceUtilities.makeShell`: dbId, displayName, and class, with no
  attributes) so the real objects are not duplicated or frozen by the store.
- The full instances live in `DataService.id2instance`, a client-side cache that is the source of
  truth for staged edits. `fetchInstance()` returns the staged version. Call
  `removeInstanceInCache()` to force a reload of the database copy. `Instance.source` holds the
  database copy for comparison views.
- [UserInstancesService](src/app/auth/login/user-instances.service.ts) persists staged work per user
  on the server (`persistInstances` / `loadInstances` / backups) and loads it at login. Staged work
  is capped at `MAX_STAGED_INSTANCES` (200).
- Commit (`DataService.commit`) works as follows:
  - It fills in referenced instances.
  - It may hold instances back for the duplicate check (`matchInstances` → matched-instances
    dialog → `MatchResolutionService`).
  - On success, `newInstOld2NewId` maps each negative dbId to the persisted one, and
    `remapNewInstanceReferenceDbId` rewrites every cached reference to use it.

`Instance.attributes` is a `Map<string, any>` in memory but a plain object on the wire. Anything
coming in from HTTP or `localStorage` must go through `InstanceUtilities.handleInstanceAttributes()`
or `DataService.registerInstance()`. Anything going out must go through `stringifyInstance()`,
which also drops `schemaClass` (a large cyclic graph).

### Cross-tab synchronization via localStorage

Curators work in several windows at once, and every window must see the same staged edits. Three
places use the `storage` DOM event for this. The event fires in every tab *except* the one that
wrote the value.

- [instance.effects.ts](src/app/instance/state/instance.effects.ts): a `{dispatch: false}` effect
  writes every mutating action to `localStorage` under the action type. The `storage` listener in
  each receiving tab dispatches the **`ls_`-prefixed twin** of that action. Reducers handle both
  actions, but only the non-`ls_` one broadcasts. That pairing prevents an infinite loop, so keep it
  when you add actions.
  - Whole-list snapshots are written under Web Locks, and they *replace* the list rather than merge
    into it (see the comment on `storeSnapshot`).
  - Register these effects with `EffectsModule.forRoot` only. Registering them per feature attaches
    the `storage` listener twice.
- [SessionSyncService](src/app/core/services/session-sync.service.ts): watches the `token` key. A
  logout or a fresh login in one tab tears down or resumes all the others.
- [UserInstancesService](src/app/auth/login/user-instances.service.ts): watches the
  `syncUserInstances` key. It handles wholesale replacement (backup restore, file import), which the
  per-action effects don't cover.

### InstanceUtilities is the imperative refresh bus

[instance.service.ts](src/app/core/services/instance.service.ts) (`InstanceUtilities`) works
alongside NgRx and handles what the store doesn't:
- RxJS `Subject`s that views subscribe to (`refreshViewDbId$`, `lastClickedDbId$`,
  `lastUpdatedInstance$`, `markDeletionDbId$`, `committedNewInstDbId$`, …).
- The `shellInstances` map, which carries a display name or dbId change to every place the instance
  is only referenced.

When a change must repaint a view, call `setRefreshViewDbId(dbId)` rather than adding a store
selector.

### Schema-driven UI

There are no hand-written forms per class. `SchemaClass` and `SchemaAttribute`
([reactome-schema.model.ts](src/app/core/models/reactome-schema.model.ts)) are fetched from the
backend and cached in `DataService`. The instance editor renders and validates fields from that
metadata:
- `cardinality`: `'1'` vs `'+'`
- `category`: `MANDATORY` / `REQUIRED` / `NOMANUALEDIT`
- `type`: `INSTANCE` vs scalar
- `allowedClases`

An `APP_INITIALIZER` in [app.module.ts](src/app/app.module.ts) loads the schema tree at bootstrap.
So `DataService.initialize()` must fail soft: it resolves even on error, so the app still starts.

### Two extension-point pipelines

Both are ordered lists that run over an instance. To add behavior, add an entry to the list rather
than special-casing callers.

- **Post-edit:** [PostEditService](src/app/core/services/post-edit.service.ts) runs every
  `PostEditOperation` after an attribute edit, in this order:
  1. The auto-fillers: LiteratureReference/PubMed, ChEBI, ReferenceSequence, ExternalOntology.
  2. `InstanceNameGenerator`, which generates display names (ported from the Java version). It must
     run after the fillers.
  3. `ReviewStatusCheck`.
- **View filters:** the `InstanceViewFilter` implementations in
  [core/instance-view-filters/](src/app/core/instance-view-filters/) run when an instance is
  *displayed*. They regenerate display names, strip references to deleted instances, and adjust
  review status. They operate on a copy. They can fire `refreshViewDbId$` while
  `InstanceViewComponent` is loading, which is a real source of race conditions there.

### Auth and session

- The JWT is stored in `localStorage['token']`. The backend also owns an HttpOnly refresh cookie.
- [HeaderInterceptor](src/app/core/interceptors/header.interceptor.ts) adds the bearer token to
  `api/curation`, `nlQueryURL`, and `llmApiURL` requests, but handles their failures differently:
  - On a curation-API 401, it retries once with the same token (to cover a transient post-login
    race), then asks [TokenRefreshService](src/app/core/services/token-refresh.service.ts) to
    refresh.
  - Tabs take turns refreshing, because a refresh token can only be spent once.
  - If an LLM or NL-query sidecar is down, that must not log the curator out. A 401 from the LLM
    service must not tear down the session either.
- [InactivityService](src/app/core/services/inactivity.service.ts) logs the curator out after 18
  idle minutes. Idle time is measured across *all* tabs and includes time when every tab was closed.
- `authGuard` / `loginGuard` and [session-url.ts](src/app/core/services/session-url.ts) remember
  where the curator was, so login returns them there rather than to `/home`.

### Feature areas

[app-routing.module.ts](src/app/app-routing.module.ts) routes to these feature areas under
[src/app](src/app), most of them lazy-loaded:

| Route | Loads | Notes |
|---|---|---|
| `schema_view` | `MainSchemaViewModule` | Schema tree plus child routes (`instance`, `class`, `list_instances`, `referrers`). The child routes are deliberate: they reuse one `MainSchemaViewComponent`, so the tree's scroll position survives navigation. |
| `event_view` | `MainEventModule` | Event tree, pathway diagram, and an embedded instance editor. |
| `paper2path` | `PaperAnnotationModule` | Paper annotation workspace backed by curator-tool-llm (`llmApiURL`), with chat, proposals, evidence, and staging import. |
| `graph_query` | `NLQueryPageComponent` (standalone) | NL→Cypher query. Results feed into the list-instances view. |
| `gene2path` | `GeneLlmComponentComponent` | Intentionally **unguarded**, because its URL was cited in grant applications. |
| `home`, `login`, `tutorial` | | |

- **Instance editor:** [instance/components/instance-view](src/app/instance/components/instance-view)
  is shared by both main views. It takes the `isInEventView`, `blockRoute`, and `needHistory` inputs
  to adapt to where it is shown.
- **Store reducers:** several feature modules register feature reducers (`instance.module.ts`,
  `status.module.ts`, `list-instances.module.ts`, `instance-bookmark.module.ts`). The same reducer
  may be registered from more than one place by design.
- **Pathway diagram:**
  [event-view/components/pathway-diagram](src/app/event-view/components/pathway-diagram) wraps
  `ngx-reactome-diagram`/Cytoscape and converts between Reactome instances and diagram objects
  (`utils/instance-converter.ts`, `utils/hyperedge.ts`, `utils/diagram-editor.service.ts`).
  Diagrams are edited under a server-side lock (`DiagramLock`) and auto-saved periodically.

## Conventions

- **Comments record bug history, at length.** Non-obvious code has a paragraph on the symptom it
  fixed and why the obvious alternative is wrong (see `storeSnapshot`, `loginGuard`,
  `handle401Error`). Match that level of detail when you touch the same code. Don't delete such a
  comment until you understand what it guards against.
- **[docs/changes_log.md](docs/changes_log.md) is for curators and is updated with each build.**
  Entries describe what changed and what curators will notice, not the implementation. Most feature
  commits touch it.
- [docs/UserGuide.md](docs/UserGuide.md) documents every UI element. Update it along with any change
  users will see.
- `ACTION_BUTTONS` in [reactome-schema.model.ts](src/app/core/models/reactome-schema.model.ts) holds
  the icon names and tooltips for all action buttons.
- Component styles are SCSS. Theming lives in `src/custom-theme.scss`, `src/_palette.scss`, and
  `src/theme-helper.scss`.
