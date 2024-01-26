import { createActionGroup, props } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const BookmarkActions = createActionGroup({
  source: "bookmark_actions",
  events: {
    // Bookmarks are selected instances
    add_bookmark: props<Instance>(),
    get_bookmark: props<Instance>(),
    remove_bookmark: props<Instance>(),
  }
})
