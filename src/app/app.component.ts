import {Component, Input} from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from './core/services/data.service';
import { Store } from '@ngrx/store';
import { InstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';

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
    // Before we do anything, load the persisted instances if any
    console.debug('App loading instances from server...');
    // TODO: Make sure this is updated during deployment
    this.dataService.loadInstances('test').subscribe((instances) => {
      // console.debug(instances);
      for (let inst of instances) {
        if (inst.dbId < 0)
          this.store.dispatch(NewInstanceActions.register_new_instance(inst));
        else
          this.store.dispatch(InstanceActions.register_updated_instance(inst));
      }
    });
  }

}

