import { Component } from '@angular/core';
import { UserInstancesService } from './auth/login/user-instances.service';
import { InactivityService } from './core/services/inactivity.service';
import { SessionSyncService } from './core/services/session-sync.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'curator-tool-frontend';
  
  // This is a hack to show different views at the top. We should use angular route to manage these views!
  current_view: string = 'home_view';

  constructor(
    private userInstancesService: UserInstancesService,
    private inactivityService: InactivityService,
    private sessionSyncService: SessionSyncService
  ) {}

  ngOnInit() {
    // Start the inactivity watchdog first: after 18 minutes without user activity the
    // session is logged out (only takes effect while a user is actually logged in). It also
    // catches a session that was already idle past the timeout before this tab ever opened
    // (e.g. every tab was closed for longer than that) and starts logging it out immediately -
    // in which case loadUserInstances() below is skipped rather than firing an authenticated
    // request with a token that's about to be invalidated.
    const sessionWasAlreadyStale = this.inactivityService.start();
    if (!sessionWasAlreadyStale) {
      this.userInstancesService.loadUserInstances();
    }
    // Log this tab out as soon as any other tab/window logs out, so a tab left open
    // behind a logout cannot keep presenting an editable, apparently-authenticated UI.
    this.sessionSyncService.start();
  }
}

