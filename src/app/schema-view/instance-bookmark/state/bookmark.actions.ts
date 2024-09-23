import {createActionGroup, emptyProps, props} from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const BookmarkActions = createActionGroup({
  source: "bookmark_actions",
  events: {
    // Bookmarks are selected instances
    add_bookmark: props<Instance>(),
    remove_bookmark: props<Instance>(),
    
    load_bookmarks: emptyProps(),
    save_bookmarks: emptyProps(),
    // Need a single object only
    set_bookmarks: props<{instances: Instance[]}>(),

    // To handle event from local storage to avoid infinity loop
    ls_add_bookmark: props<Instance>(),
    ls_remove_bookmark: props<Instance>(),
  }
})
