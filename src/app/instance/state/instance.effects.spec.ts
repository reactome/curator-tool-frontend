import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Store, StoreModule } from '@ngrx/store';
import { firstValueFrom, of, ReplaySubject } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { NewInstanceActions, UpdateInstanceActions } from './instance.actions';
import { InstanceEffects } from './instance.effects';
import {
  defaultPersonReducer, deletedInstancesReducer, newInstancesReducer, updatedInstancesReducer,
} from './instance.reducers';
import {
  DEFAUT_PERSON_STATE_NAME, DELETE_INSTANCES_STATE_NAME, NEW_INSTANCES_STATE_NAME, UPDATE_INSTANCES_STATE_NAME,
} from './instance.selectors';

describe('InstanceEffects, replacing the staged instances', () => {
  const actions$ = new ReplaySubject<any>(1);
  let store: Store;
  let fetched: number[][];

  const full = (dbId: number): Instance => ({
    dbId, displayName: `inst ${dbId}`, schemaClassName: 'Reaction',
    attributes: new Map<string, any>([['dbId', dbId]]),
  } as Instance);

  beforeEach(() => {
    localStorage.clear();
    fetched = [];
    // the effects listen to storage events for the life of the page; do not leak that into other specs
    spyOn(window, 'addEventListener');
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({}),
        StoreModule.forFeature(UPDATE_INSTANCES_STATE_NAME, updatedInstancesReducer),
        StoreModule.forFeature(NEW_INSTANCES_STATE_NAME, newInstancesReducer),
        StoreModule.forFeature(DELETE_INSTANCES_STATE_NAME, deletedInstancesReducer),
        StoreModule.forFeature(DEFAUT_PERSON_STATE_NAME, defaultPersonReducer),
      ],
      providers: [
        InstanceEffects,
        provideMockActions(() => actions$),
        { provide: DataService, useValue: { fetchInstances: (ids: number[]) => { fetched.push(ids); return of(ids.map(full)); } } },
        { provide: InstanceUtilities, useValue: {} },
      ],
    });
    store = TestBed.inject(Store);
  });

  function run(effect: any, action: any) {
    effect.subscribe();
    store.dispatch(action);
    actions$.next(action);
  }

  // the snapshot is written under a Web Lock, so it lands a moment after the action
  async function snapshot(key: string, changedFrom: string | null = null): Promise<any[]> {
    for (let i = 0; i < 100 && localStorage.getItem(key) === changedFrom; i++)
      await new Promise(r => setTimeout(r, 10));
    return JSON.parse(JSON.parse(localStorage.getItem(key)!).object);
  }

  it('writes the new instances to local storage, where a new tab reads them', async () => {
    const effects = TestBed.inject(InstanceEffects);
    run(effects.replacedInstancesSnapshot$, NewInstanceActions.set_new_instances({
      instances: [{ dbId: -1, displayName: 'a', schemaClassName: 'Reaction' }, { dbId: -2, displayName: 'b', schemaClassName: 'Reaction' }],
    }));
    const saved = await snapshot(NewInstanceActions.get_new_instances.type);
    expect(saved.map((i: any) => i.dbId)).toEqual([-1, -2]);
    expect(saved[0].attributes.dbId).toBe(-1);
    expect(fetched).toEqual([[-1, -2]]);
  });

  it('writes an emptied list too, so an old snapshot cannot come back', async () => {
    const effects = TestBed.inject(InstanceEffects);
    const old = JSON.stringify({ object: '[{"dbId":5}]' });
    localStorage.setItem(UpdateInstanceActions.get_updated_instances.type, old);
    run(effects.replacedInstancesSnapshot$, UpdateInstanceActions.set_updated_instances({ instances: [] }));
    expect(await snapshot(UpdateInstanceActions.get_updated_instances.type, old)).toEqual([]);
  });
});
