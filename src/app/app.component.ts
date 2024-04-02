import {Component, Input} from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'curator-tool-frontend';
  loggedIn: boolean | null = false;

  // This is a hack to show different views at the top. We should use angular route to manage these views!
  current_view: string = 'home_view';

  constructor(private router: Router) {}


  ngOnInit() {
    this.loggedIn = sessionStorage.getItem('authenticated') === 'true';
    // Bypass for the time being
    //this.loggedIn = false;
    let url = window.location.pathname;
    console.debug('url: ', url);
    if (url.includes('llm_apps')) {
      this.current_view = 'llm_apps_view';
    }
    else if (url.includes('home') || (url === '/')) { // This should be the default
      this.current_view = 'home_view';
    }
    else if (url.includes('event')) {
      this.current_view = 'event_view';
    }
    else {
      this.current_view = 'schema_view'; // Only support this now.
    }
    this.router.navigate([url]);
  }

  switch_view(view: any) {
    this.current_view = view;
    // Another hack to show something here
    if (this.current_view === 'home_view') {
      this.router.navigate(['/home'])
    }
    else if (this.current_view === 'llm_apps_view') {
      this.router.navigate(['/llm_apps_view'])
    }
    else if (this.current_view === 'event_view') {
      this.router.navigate(['/event_view'])
    }
    else {
      this.router.navigate(['/schema_view']);
    }
  }

}

