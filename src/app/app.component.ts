import { Component } from '@angular/core';
import { UserInstancesService } from './auth/login/user-instances.service';
import { InactivityService } from './core/services/inactivity.service';

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
    private inactivityService: InactivityService
  ) {}

  ngOnInit() {
    this.userInstancesService.loadUserInstances();
    // Start the inactivity watchdog: after 18 minutes without user activity the
    // session is logged out (only takes effect while a user is actually logged in).
    this.inactivityService.start();
  }
}

