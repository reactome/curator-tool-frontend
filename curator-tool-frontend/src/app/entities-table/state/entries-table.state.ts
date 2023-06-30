//import {createEntityAdapter, EntityState} from "@ngrx/entity";

// type PartialRequired<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;

// export interface Method {
//   name: string;
//   description: string;
//   parameterIds: string[];
// }

// export interface MethodState extends EntityState<Method> {
//   selectedMethodName: string | null;
// }

// export interface EntriesDataState {
//     selectedEntry: string | null;
// }

// export const methodAdapter = createEntityAdapter<Method>({
//   selectId: model => model.name
// })


// export const initialState: MethodState = methodAdapter.getInitialState({selectedMethodName: null})
