import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { DeleteInstanceActions, InstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { Instance, UserInstances } from './core/models/reactome-instance.model';
import { DataService } from './core/services/data.service';
import { BookmarkActions } from './schema-view/instance-bookmark/state/bookmark.actions';

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
    this.dataService.startLoadInstances();
    this.dataService.loadUserInstances('test').subscribe((userInstances: UserInstances) => {
      // console.debug(userInstance);
      // Instances have been cloned at dataService
      userInstances.newInstances?.forEach(inst => this.store.dispatch(NewInstanceActions.register_new_instance(inst)));
      userInstances.updatedInstances?.forEach(inst => this.store.dispatch(InstanceActions.register_updated_instance(inst)));
      userInstances.deletedInstances?.forEach(inst => this.store.dispatch(DeleteInstanceActions.register_deleted_instance(inst)));
      userInstances.bookmarks?.forEach(inst => this.store.dispatch(BookmarkActions.add_bookmark(inst)));
      // The following two statements will force the dataService to finish the loading first
      this.dataService.getLoadInstanceSubject()!.next();
      this.dataService.getLoadInstanceSubject()!.complete();
      this.dataService.stopLoadInstance();
    });
  }

}

