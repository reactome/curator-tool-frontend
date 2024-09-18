import { CdkDrag, CdkDragPlaceholder, CdkDropList } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatTooltipModule } from "@angular/material/tooltip";
import { StoreModule } from "@ngrx/store";
import { SharedModule } from "../../shared/shared.module";
import { bookmarkReducer } from "./state/bookmark.reducers";
import { BOOKMARK_STATE_NAME } from "./state/bookmark.selectors";
import { BookmarkListComponent } from "./components/bookmark-list/bookmark-list.component";


@NgModule({
  declarations: [
    BookmarkListComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    MatExpansionModule,
    CdkDropList,
    CdkDrag,
    StoreModule.forFeature(BOOKMARK_STATE_NAME, bookmarkReducer),
    MatTooltipModule,
    CdkDragPlaceholder
  ],
  exports: [
    BookmarkListComponent
  ]
})
export class InstanceBookmarkModule {
}
