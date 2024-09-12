import {createActionGroup, emptyProps, props} from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';

export const BookmarkActions = createActionGroup({
  source: "bookmark_actions",
  events: {
    // Bookmarks are selected instances
    add_bookmark: props<Instance>(),
    remove_bookmark: props<Instance>(),
    // Used to handle action recevied from broadcast so that
    // we don't need to send another action to avoid an infinity loop
    bc_add_bookmark: props<Instance>(),
    bc_remove_bookmark: props<Instance>(),

    load_bookmarks: emptyProps(),
    save_bookmarks: emptyProps(),
    set_bookmarks: props<{instances: Instance[]}>(),
  }
})
