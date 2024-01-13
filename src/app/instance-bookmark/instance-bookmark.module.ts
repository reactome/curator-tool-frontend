import {BookmarkListComponent} from "./components/bookmark-status/bookmark-list/bookmark-list.component";
import {BookmarkStatusComponent} from "./components/bookmark-status/bookmark-status.component";
import {CommonModule} from "@angular/common";
import {SharedModule} from "../shared/shared.module";
import {NgModule} from "@angular/core";
import {MatExpansionModule} from "@angular/material/expansion";
import {CdkDrag, CdkDropList} from "@angular/cdk/drag-drop";
import {EffectsModule} from "@ngrx/effects";
import {StoreModule} from "@ngrx/store";
import {BookmarkEffects} from "./state/bookmark.effects";
import {BOOKMARK_STATE_NAME} from "./state/bookmark.selectors";
import {bookmarkReducer} from "./state/bookmark.reducers";

@NgModule({
  declarations: [
    BookmarkListComponent,
    BookmarkStatusComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    MatExpansionModule,
    CdkDropList,
    CdkDrag,
    EffectsModule.forFeature(BookmarkEffects),
    StoreModule.forFeature(BOOKMARK_STATE_NAME, bookmarkReducer),
  ],
  exports: [
    BookmarkStatusComponent
  ]
})
export class InstanceBookmarkModule {
}
