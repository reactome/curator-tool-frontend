import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Action } from '@ngrx/store';
import { Subject } from 'rxjs';

// The following implementation of BraodcaseService is based on this post and its associated GitHub
// repo: https://medium.com/@stefanoslignos/synchronizing-app-state-across-iframes-using-ngrx-and-the-broadcast-channel-api-774bd189d69b. 
@Injectable({
  providedIn: 'root',
})
export class BroadcastService implements OnDestroy {
  private readonly broadcastChannel: BroadcastChannel;
  private readonly _onMessage$ = new Subject<Action>();
  readonly onMessage$ = this._onMessage$.asObservable();

  constructor(private readonly ngZone: NgZone) {
    this.broadcastChannel = new BroadcastChannel('bookmark-channel');

    // Listen to bookmarks added or deleted from other tabs
    this.broadcastChannel.onmessage = (message) => {
      this.ngZone.run(() => this._onMessage$.next(message.data));
    };

  }
  // Broadcast message to other tabs
  broadcast(data: any): void {
    this.broadcastChannel.postMessage(data);
  }

  ngOnDestroy(): void {
    // Close the broadcast channel when service is destroyed
    this.broadcastChannel.close();
  }
}
