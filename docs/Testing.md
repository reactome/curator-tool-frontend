# Testing

Two suites, with different jobs.

| | Unit / integration | End-to-end |
|---|---|---|
| Runner | Karma + Jasmine (`ng test`) | Playwright |
| Lives in | `src/**/*.spec.ts` | `e2e/tests/` |
| Covers | component and service logic in isolation | whole user journeys in a real browser |
| Backend | not involved | `/api/**` mocked at the network layer |
| Count | 906 | 82 |
| Runtime | ~10s | ~30s |

Neither needs a backend, Neo4j, or credentials. Both should be green before a merge.

---

## Unit / integration suite

```bash
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx ng test --watch=false --browsers=ChromeHeadless
```

Scope it to what you are working on with `--include`:

```bash
... npx ng test --include='src/app/instance/**/*.spec.ts'
```

`ng test` prints `Some of your tests did a full page reload!` and an `ERROR` line even on a
fully passing run. It is cosmetic — a quirk of this Angular/Karma combination that reproduces
with a single trivial spec — and the **exit code is still 0**. Judge the run by
`TOTAL: n SUCCESS` and the exit code, not by that line.

### The test harness (`src/testing/`)

Before writing a component spec, look here. Historically most specs in this repo were
auto-generated `should create` stubs that failed because the component needed a `Store`, an
`HttpClient`, a `MAT_DIALOG_DATA`, an `ActivatedRoute`, or a `ChangeDetectorRef` that the spec
never provided. The harness exists so that is a solved problem rather than a per-spec puzzle.

```ts
import { commonTestProviders, componentTestImports, makeInstance } from 'src/testing';

TestBed.configureTestingModule({
  imports: [...componentTestImports()],
  providers: [...commonTestProviders(), { provide: Thing, useValue: myThing }],
  schemas: [NO_ERRORS_SCHEMA],
});
```

Later providers win in Angular DI, so anything you add overrides a harness default.

| File | What it gives you |
|---|---|
| `test-providers.ts` | `commonTestProviders()`, `componentTestImports()`, `provideDialogContext()`, route/router/snackbar/CD stubs |
| `test-doubles.ts` | `createDataServiceSpy()`, `createInstanceUtilitiesSpy()`, dialog spies, `expectDialogService()` |
| `fixtures.ts` | `makeInstance()`, `makeSchemaClass()`, `makeSchemaClassTree()`, QA-report and referrer factories |
| `mock-store.ts` | `provideStoreSpy()` (recording double) and `testStoreImports()` (real store over the app's reducers) |
| `api-fixtures.ts` | backend responses in wire format — **shared with the E2E suite** |
| `harness.spec.ts` | the harness's own tests; run these first if specs start failing oddly |

Things the doubles get right that a bare `createSpyObj` does not, and which cost real debugging
time to rediscover:

- **`AttributeEditService` methods return `true`.** The edit components treat a falsy result as
  "the instance already held this value" and skip the rest of the edit, so a spy left returning
  `undefined` makes a successful edit look like a no-op and the spec fails on the *next* step.
- **`DataService.fetchInstance` is stubbed.** `finishEdit` re-fetches the edited instance, so the
  first edit of a batch throws without it.
- **`InstanceUtilities`' `*$` observables are live `Subject`s**, not `of()`. Components subscribe
  in `ngOnInit`, so a spec needs to emit *after* setup.
- **`StoreSpy.select` is backed by a `BehaviorSubject`.** A completing `of()` makes
  `combineLatest(...).pipe(skip(1))` unable to ever emit, which makes anything driven by a
  *second* emission look dead.

### Known trap: circular imports

`InstanceListViewComponent` and `BatchEditDialogComponent` throw "Cannot access ... before
initialization" when imported directly, because of a cycle through `MatchResolutionService` →
`MatchedInstancesDialogComponent` → `ListInstancesModule`. Their specs import
`match-instances-dialog.component` first for the side effect. Keep that import if you touch them.

---

## End-to-end suite

```bash
cd e2e
npm install            # once
npm run install-browsers   # once — downloads Chromium
npm test
```

Other entry points: `npm run test:headed`, `npm run test:ui` (Playwright's watch UI),
`npm run report` (last HTML report). Filter with `npx playwright test -g "commit"`.

Playwright starts `ng serve` itself and reuses an already-running one, so keeping `npm start`
open in another terminal makes iteration much faster.

### How the mocking works

`e2e/fixtures/api-mock.ts` intercepts every `/api/**` request and answers it from
`DEFAULT_API_ROUTES` in `src/testing/api-fixtures.ts` — the same fixtures the unit suite uses.
Sharing them is deliberate: if the two suites described the server differently, "all green"
would stop meaning the frontend agrees with one description of the backend.

Two properties worth preserving:

- **Nothing reaches the network.** An unmatched request is aborted and recorded on
  `api.unmatchedRequests`, never passed through. Falling through to a real localhost backend
  would make the suite pass or fail depending on whether one happened to be running. Call
  `expectNoUnmatchedRequests(api)` to catch an endpoint added without a fixture.
- **Writes are observable.** `api.writesTo('/commit')` returns what the frontend actually sent,
  which is how the commit tests assert on payloads with no database to inspect.

Per-test escapes: `api.override({...})` to replace one route, `api.failNext('/commit', 500)` to
make the next matching request fail.

### Fixtures must match the wire format, not the app's models

Several of these were only discovered by watching the app break against a plausible-looking
guess. If a view renders empty or hangs on a spinner, suspect the fixture first:

- `/getAttributes/{class}` returns entries with the enum **names** for `category`/`definingType`
  and everything else nested under `properties`, with fully-qualified Java class names.
  `InstanceUtilities.convertToSchemaClass` derives the data type and allowed classes from
  `attributeClasses[].type`. A fixture written in the already-converted `SchemaAttribute` shape
  produces an instance view with **no attribute rows at all**.
- `/getEventTree/{species}` returns a **flat array** of top-level events; `fetchEventTree` wraps
  it in a synthetic root. Returning a single object leaves the event view stuck on its spinner.
- `/auth/login` returns the **bare token string**. Wrapping it in `{ token }` stores
  `"[object Object]"` and bounces the curator back to `/login`.
- `defaultPerson` in `/loadInstances/{user}` is a **shell**. `hydrateUserInstances` converts the
  new/updated/deleted buckets' attributes to `Map`s but deliberately leaves `defaultPerson`
  alone, so full `attributes` there make `stringifyInstance` throw "object is not iterable".

### Fixtures, not `test` from Playwright

Import `test` from `e2e/fixtures/test.ts`, not `@playwright/test`. It installs the mock backend
and the session automatically (`{ auto: true }`), which matters: Playwright only instantiates a
fixture a test *destructures*, so as an ordinary fixture this silently skipped every spec written
`async ({ page })` and those all ended up redirected to `/login`.

Use `{ anonymousPage }` for a page with no session (login and route-guard specs).

### Selector notes

- Action buttons are Material icon ligatures — the icon name *is* the text (`upload`, `delete`,
  `compare`, `list_alt`, `checklist`). Match the enclosing `button`, not the `mat-icon`, which is
  `aria-hidden` and not clickable.
- `compare` and `upload` are **disabled until the instance has changes**, so a commit test has to
  make an edit first.
- Scalar attribute values live in `<input>`/`<textarea>`, so assert with `toHaveValue`, not text.
- Dialogs are modal: the form behind one is inert until it closes, and the dialog often has its
  own `OK` button, so scope form locators (e.g. to `app-auth-form`).
- An edit is staged to `localStorage` via the ngrx effects; nothing is sent to the server until
  commit, a five-minute idle auto-persist, or page unload. Don't wait for a request after typing.
- Instance-valued slots reveal their `edit` FAB (`button.row-action-fab`) on hover only, so hover
  the value's `a.value-link` before clicking it. Right-click on the value opens the same menu.

### Catching a thrown error

`page.on('pageerror')` does **not** see an exception thrown inside Angular: `ErrorHandler` catches
it and logs it, so the only trace is a console message. Listen for both, or a component that has
quietly stopped working looks like a passing test:

```ts
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
```

This is how the cyclic-`hasEvent` bug in `event-tree-edit.spec.ts` was found — a `RangeError` from
`MatTreeFlattener` that left the event tree showing stale data and nothing else to see.

---

## Suggested package.json scripts

The root `package.json` is `skip-worktree` on at least one developer's clone, so scripts added
there are not reliably shared. If that changes, these are worth adding:

```json
"test:headless": "ng test --watch=false --browsers=ChromeHeadless",
"test:e2e": "cd e2e && npm test"
```
