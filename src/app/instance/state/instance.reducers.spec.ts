import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DeleteInstanceActions } from './instance.actions';
import { deletedInstancesAdaptor, deletedInstancesReducer } from './instance.reducers';

describe('deletedInstancesReducer', () => {
  const inst = (dbId: number): Instance => ({ dbId, displayName: `d${dbId}`, schemaClassName: 'Reaction' });
  const ids = (state: any) => deletedInstancesAdaptor.getSelectors().selectAll(state).map(i => i.dbId);
  const staged = (...dbIds: number[]) =>
    dbIds.reduce((state, id) => deletedInstancesReducer(state, DeleteInstanceActions.register_deleted_instance(inst(id))),
      deletedInstancesAdaptor.getInitialState());

  it('replaces what was staged when the whole list is set', () => {
    const state = deletedInstancesReducer(staged(1, 2), DeleteInstanceActions.set_deleted_instances({ instances: [inst(3)] }));
    expect(ids(state)).toEqual([3]);
  });

  it('empties the list when an empty list is set', () => {
    const state = deletedInstancesReducer(staged(1, 2), DeleteInstanceActions.set_deleted_instances({ instances: [] }));
    expect(ids(state)).toEqual([]);
  });

  it('still adds and removes one deletion at a time', () => {
    let state = staged(1);
    state = deletedInstancesReducer(state, DeleteInstanceActions.register_deleted_instance(inst(2)));
    expect(ids(state)).toEqual([1, 2]);
    state = deletedInstancesReducer(state, DeleteInstanceActions.remove_deleted_instance(inst(1)));
    expect(ids(state)).toEqual([2]);
  });
});
