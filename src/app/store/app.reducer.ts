import { createReducer, on } from '@ngrx/store';
import { updateSharedState } from './app.actions';

export interface AppState {
  sharedData: any;
}

export const initialState: AppState = {
  sharedData: null,
};

export const appReducer = createReducer(
  initialState,
  on(updateSharedState, (state, { payload }) => ({ ...state, sharedData: payload }))
);
