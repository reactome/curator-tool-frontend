import { EntityState, createEntityAdapter } from "@ngrx/entity";
import { createReducer, on } from "@ngrx/store";
import { Instance } from "src/app/core/models/reactome-instance.model";
import {BookmarkActions} from "./bookmark.actions";

/**
 * Reducer to handle new bookmarks
 */
export interface BookmarkState extends EntityState<Instance> {
}

export const bookmarkAdaptor = createEntityAdapter<Instance>({
  selectId: instance => instance.dbId
})

export const bookmarkReducer = createReducer(
  bookmarkAdaptor.getInitialState(),
  on(BookmarkActions.add_bookmark,
    (state, instance) => bookmarkAdaptor.upsertOne(instance, state)
  ),
  on(BookmarkActions.remove_bookmark,
    (state, instance) => bookmarkAdaptor.removeOne(instance.dbId, state))
)
