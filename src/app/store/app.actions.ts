import { createAction, props } from '@ngrx/store';

export const updateSharedState = createAction(
  '[Shared] Update State',
  props<{ payload: any }>()
);
