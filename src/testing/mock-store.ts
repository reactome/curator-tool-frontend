/**
 * A Store double that understands this app's actual feature state.
 *
 * `@ngrx/store/testing`'s `provideMockStore` needs every selector a component reads to be
 * declared up front, which makes it awkward for the container components here -- they read
 * four or five instance selectors plus bookmarks. `provideTestStore` instead builds a real
 * `StoreModule.forRoot` over the app's own reducers, so selectors resolve for free and a
 * dispatched action actually changes state. That makes it possible to assert on the
 * *outcome* of a dispatch rather than only that `dispatch` was called.
 *
 * Use `provideStoreSpy()` when the assertion really is "did it dispatch X" and you want a
 * plain spy with no state behind it.
 */

import { Provider } from '@angular/core';
import { Action, Store, StoreModule } from '@ngrx/store';
import { BehaviorSubject, Observable } from 'rxjs';

import { UserInstances } from '../app/core/models/reactome-instance.model';
import {
  DeleteInstanceActions,
  NewInstanceActions,
  UpdateInstanceActions
} from '../app/instance/state/instance.actions';
import {
  defaultPersonReducer,
  deletedInstancesReducer,
  newInstancesReducer,
  updatedInstancesReducer
} from '../app/instance/state/instance.reducers';
import {
  DEFAUT_PERSON_STATE_NAME,
  DELETE_INSTANCES_STATE_NAME,
  NEW_INSTANCES_STATE_NAME,
  UPDATE_INSTANCES_STATE_NAME
} from '../app/instance/state/instance.selectors';
import { bookmarkReducer } from '../app/schema-view/instance-bookmark/state/bookmark.reducers';
import { BOOKMARK_STATE_NAME } from '../app/schema-view/instance-bookmark/state/bookmark.selectors';

/**
 * The app's own reducer map, keyed by the same feature names the selectors use.
 * Import this into `StoreModule.forRoot` when a spec needs a working store.
 */
export const TEST_REDUCERS = {
  [UPDATE_INSTANCES_STATE_NAME]: updatedInstancesReducer,
  [NEW_INSTANCES_STATE_NAME]: newInstancesReducer,
  [DELETE_INSTANCES_STATE_NAME]: deletedInstancesReducer,
  [DEFAUT_PERSON_STATE_NAME]: defaultPersonReducer,
  [BOOKMARK_STATE_NAME]: bookmarkReducer
};

/**
 * Imports for `TestBed.configureTestingModule({ imports: [...] })` that give the spec a real,
 * working store over the app's reducers.
 */
export const testStoreImports = () => [StoreModule.forRoot(TEST_REDUCERS)];

/**
 * A recording Store double: `select` returns the configured observable for any selector and
 * `dispatch` records every action. Cheaper than a real store and the right choice when the
 * component only pushes actions out.
 */
export interface StoreSpy extends Store {
  /** Every action passed to `dispatch`, in order. */
  dispatchedActions: Action[];
  /** Actions of one type, narrowed. Matches on the action's `type` string. */
  actionsOfType<T extends Action>(type: string): T[];
  /** The last dispatched action, or undefined if nothing was dispatched. */
  lastAction(): Action | undefined;
  /**
   * Push a new value through every selector. Each `select()` is backed by a live
   * `BehaviorSubject`, so already-subscribed components see this as a fresh emission -- which
   * is what a spec needs to exercise an operator chain that discards the first one
   * (`skip(1)`, `debounceTime`, `pairwise`, ...).
   */
  setSelectResult(value: unknown): void;
}

/**
 * Builds a `StoreSpy`. `selectResult` is what every `select()` call emits first -- an empty
 * array is right for the entity-list selectors, which is what nearly every component reads.
 *
 * The backing subject is deliberately a `BehaviorSubject` rather than a bare `of()`: a
 * completing observable makes `combineLatest(...).pipe(skip(1))` unable to ever emit, so a
 * component whose behaviour hangs off a *second* emission looks dead in tests.
 */
export function createStoreSpy(selectResult: unknown = []): StoreSpy {
  const dispatchedActions: Action[] = [];
  const current = new BehaviorSubject<unknown>(selectResult);

  const spy = {
    dispatchedActions,
    dispatch: (action: Action) => {
      dispatchedActions.push(action);
    },
    select: (): Observable<any> => current.asObservable(),
    pipe: (): Observable<any> => current.asObservable(),
    subscribe: (fn: (value: any) => void) => current.subscribe(fn),
    actionsOfType<T extends Action>(type: string): T[] {
      return dispatchedActions.filter(a => a.type === type) as T[];
    },
    lastAction: () => dispatchedActions[dispatchedActions.length - 1],
    setSelectResult: (value: unknown) => current.next(value)
  };

  return spy as unknown as StoreSpy;
}

/** Provider for a `StoreSpy`. Pair with `TestBed.inject(Store) as unknown as StoreSpy`. */
export function provideStoreSpy(selectResult: unknown = []): Provider {
  return { provide: Store, useValue: createStoreSpy(selectResult) };
}

/**
 * Seeds a real test store with staged edits, the way `loadUserInstances` does at login.
 * Dispatches the `set_*` bulk actions rather than poking at state, so the reducers stay
 * in the loop and a change to them is caught here.
 */
export function seedStagedInstances(store: Store, staged: Partial<UserInstances>): void {
  store.dispatch(NewInstanceActions.set_new_instances({ instances: staged.newInstances ?? [] }));
  store.dispatch(UpdateInstanceActions.set_updated_instances({ instances: staged.updatedInstances ?? [] }));
  store.dispatch(DeleteInstanceActions.set_deleted_instances({ instances: staged.deletedInstances ?? [] }));
}
