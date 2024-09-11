import { Injectable, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import {BookmarkState} from "../../schema-view/instance-bookmark/state/bookmark.reducers";
import {BookmarkActions} from "../../schema-view/instance-bookmark/state/bookmark.actions";

@Injectable({
  providedIn: 'root',
})
export class BroadcastService implements OnDestroy {
  private broadcastChannel: BroadcastChannel;

  constructor(private store: Store<BookmarkState>) {
    this.broadcastChannel = new BroadcastChannel('bookmark-channel');

    // Listen to bookmarks added or deleted from other tabs
    this.broadcastChannel.onmessage = () => {
      this.store.dispatch(BookmarkActions.load_bookmarks());
      console.log("in broadcast channel");
    };

  }
  // Broadcast message to other tabs
  broadcast(data: any): void {
    this.broadcastChannel.postMessage(data);
    this.store.dispatch(BookmarkActions.load_bookmarks());
    console.log("in broadcast channel");
  }

  ngOnDestroy(): void {
    // Close the broadcast channel when service is destroyed
    this.broadcastChannel.close();
  }
}
