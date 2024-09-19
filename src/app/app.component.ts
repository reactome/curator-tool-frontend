import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { DeleteInstanceActions, InstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { UserInstances } from './core/models/reactome-instance.model';
import { DataService } from './core/services/data.service';
import { BookmarkActions } from './schema-view/instance-bookmark/state/bookmark.actions';
import { finalize } from 'rxjs';

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
    this.dataService.loadUserInstances('test').pipe(
      finalize(() => {
        // These statements will always run regardless of what happens inside
        // The following two statements will force the dataService to finish the loading first
        this.dataService.getLoadInstanceSubject()!.next();
        this.dataService.getLoadInstanceSubject()!.complete();
        this.dataService.stopLoadInstance();
        // Call this in case there are existing dbId
        this.dataService.resetNextNewDbId(); 
      })
      ).subscribe((userInstances: UserInstances) => {
      // console.debug(userInstance);
      // Instances have been cloned at dataService
      // To be pulled out so that there is no need to call the server when the status is pushed
      // in the localStorage.
      this.checkLocalStorage(userInstances);
      if (userInstances.newInstances && userInstances.newInstances.length > 0)
        this.store.dispatch(NewInstanceActions.set_new_instances({instances: userInstances.newInstances}));
      userInstances.updatedInstances?.forEach(inst => this.store.dispatch(InstanceActions.register_updated_instance(inst)));
      userInstances.deletedInstances?.forEach(inst => this.store.dispatch(DeleteInstanceActions.register_deleted_instance(inst)));
      if (userInstances.bookmarks && userInstances.bookmarks.length > 0)
        this.store.dispatch(BookmarkActions.set_bookmarks({instances: userInstances.bookmarks}));
    });
  }

  private checkLocalStorage(userInstances: UserInstances) {
    const bookmarks = localStorage.getItem(BookmarkActions.set_bookmarks.type);
    if (bookmarks) {
      const bookmarkInsts = JSON.parse(bookmarks);
      userInstances.bookmarks = bookmarkInsts;
    }
    // Instances have been persisted in localstorage fully. Therefore, we need to register
    // them only without actually loading from the database. 
    // schemaClass will be handled whenever it is needed. 
    const updated = localStorage.getItem(InstanceActions.get_updated_instances.type);
    if (updated) {
      const updatedInsts = JSON.parse(updated);
      userInstances.updatedInstances = updatedInsts;
      updatedInsts.forEach((inst: any) => this.dataService.registerInstance(inst));
    }
    const newInstText = localStorage.getItem(NewInstanceActions.get_new_instances.type);
    if (newInstText) {
      const newInstances = JSON.parse(newInstText);
      userInstances.newInstances = newInstances;
      newInstances.forEach((inst: any) => this.dataService.registerInstance(inst));
    }
    const deleted = localStorage.getItem(DeleteInstanceActions.get_deleted_instances.type);
    if (deleted) {
      const deletedInsts = JSON.parse(deleted);
      userInstances.deletedInstances = deletedInsts;
      deletedInsts.forEach((inst: any) => this.dataService.registerInstance(inst));
    }
  }

}

