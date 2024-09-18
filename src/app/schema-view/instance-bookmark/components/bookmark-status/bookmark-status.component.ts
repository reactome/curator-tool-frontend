import {Component, OnInit} from '@angular/core';
import {bookmarkedInstances} from "../../state/bookmark.selectors";
import {Store} from "@ngrx/store";
import {Instance} from "../../../../core/models/reactome-instance.model";
import {updateSharedState} from "../../../../store/app.actions";

@Component({
  selector: 'app-bookmark-status',
  templateUrl: './bookmark-status.component.html',
  styleUrls: ['./bookmark-status.component.scss']
})
export class BookmarkStatusComponent implements OnInit{
  bookmarkList: Instance[] = [];

  constructor(private store: Store) {
  }

  ngOnInit() {
    // this.store.select(bookmarkedInstances()).subscribe((instances) => {
    //   if (instances !== undefined) {
    //     this.bookmarkList = instances;
    //   }
    // })
  }
}
