import {Component, Input} from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from './core/services/data.service';
import { Store } from '@ngrx/store';
import { InstanceActions, NewInstanceActions } from './schema-view/instance/state/instance.actions';

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

  constructor(private router: Router,
    private dataService: DataService,
    private store: Store
  ) {}

  ngOnInit() {
    this.loggedIn = sessionStorage.getItem('authenticated') === 'true';
    // this.loggedIn = true;
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
   
    // Before we do anything, load the persisted instances if any
    console.debug('App loading instances from server...');
    this.dataService.loadInstances('test').subscribe((instances) => {
      console.debug(instances);
      for (let inst of instances) {
        if (inst.dbId < 0)
          this.store.dispatch(NewInstanceActions.register_new_instance(inst));
        else
          this.store.dispatch(InstanceActions.register_updated_instance(inst));
      }
    });

    this.router.navigate([url]);
  }

}

