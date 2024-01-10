import {createFeatureSelector, createSelector} from "@ngrx/store";
import {bookmarkAdaptor, BookmarkState} from "./bookmark.reducers";

export const BOOKMARK_STATE_NAME = 'bookmark'
export const bookmarkState = createFeatureSelector<BookmarkState>(BOOKMARK_STATE_NAME);
export const bookmarkedInstances = () => createSelector(
  bookmarkState,
  (state: BookmarkState) => bookmarkAdaptor.getSelectors().selectAll(state)
)
