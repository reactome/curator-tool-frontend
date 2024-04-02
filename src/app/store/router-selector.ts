import * as fromRouter from '@ngrx/router-store';
import {createFeatureSelector, createSelector} from "@ngrx/store";
import {selectSchemaClassArray} from "../schema-view/instance/state/instance.selectors";

export interface State {
  router: fromRouter.RouterReducerState<any>;
}

export const selectRouter = createFeatureSelector<
  State,
  fromRouter.RouterReducerState<any>
>('router');

const {
  selectQueryParams,    // select the current route query params
  selectQueryParam,     // factory function to select a query param
  selectRouteParams,    // select the current route params
  selectRouteParam,     // factory function to select a route param
  selectRouteData,      // select the current route data
  selectUrl,            // select the current url
} = fromRouter.getSelectors(selectRouter);

export const selectSelectedDbId = selectQueryParam('dbId');
// export const selectCar = createSelector(
//   selectSchemaClassArray,
//   selectSelectedDbId,
//   (databaseObject, dbId) => cars[carId]
// );

// export const selectCarsByColor = createSelector(
//   selectCarEntities,
//   selectQueryParams,
//   (cars, params) => cars.filter(c => c.color === params['color'])
// );
