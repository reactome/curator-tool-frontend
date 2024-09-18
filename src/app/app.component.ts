import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { DeleteInstanceActions, InstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { Instance, UserInstances } from './core/models/reactome-instance.model';
import { DataService } from './core/services/data.service';
import { BookmarkActions } from './schema-view/instance-bookmark/state/bookmark.actions';
import { Observable, of } from 'rxjs';

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
      // To be pulled out so that there is no need to call the server when the status is pushed
      // in the localStorage.
      this.checkLocalStorage(userInstances).subscribe(instances => {
        userInstances.newInstances?.forEach(inst => this.store.dispatch(NewInstanceActions.register_new_instance(inst)));
        userInstances.updatedInstances?.forEach(inst => this.store.dispatch(InstanceActions.register_updated_instance(inst)));
        userInstances.deletedInstances?.forEach(inst => this.store.dispatch(DeleteInstanceActions.register_deleted_instance(inst)));
        if (userInstances.bookmarks && userInstances.bookmarks.length > 0)
          this.store.dispatch(BookmarkActions.set_bookmarks({instances: userInstances.bookmarks}));
        // The following two statements will force the dataService to finish the loading first
        this.dataService.getLoadInstanceSubject()!.next();
        this.dataService.getLoadInstanceSubject()!.complete();
        this.dataService.stopLoadInstance();
      });
    });
  }

  private checkLocalStorage(userInstances: UserInstances): Observable<Instance[]> {
    const bookmarks = localStorage.getItem(BookmarkActions.set_bookmarks.type);
    if (bookmarks) {
      const bookmarkInsts = JSON.parse(bookmarks);
      userInstances.bookmarks = bookmarkInsts;
    }
    const toBeLoadedDbIds: number[] = [];
    const updated = localStorage.getItem(InstanceActions.get_updated_instances.type);
    if (updated) {
      const updatedInsts = JSON.parse(updated);
      userInstances.updatedInstances = updatedInsts;
      updatedInsts.forEach((inst: any) => toBeLoadedDbIds.push(inst.dbId));
    }
    const newInstText = localStorage.getItem(NewInstanceActions.get_new_instance.type);
    if (newInstText) {
      const newInstances = JSON.parse(newInstText);
      userInstances.newInstances = newInstances;
      newInstances.forEach((inst: any) => toBeLoadedDbIds.push(inst.dbId));
    }
    const deleted = localStorage.getItem(DeleteInstanceActions.get_deleted_instances.type);
    if (deleted) {
      const deletedInsts = JSON.parse(deleted);
      userInstances.deletedInstances = deletedInsts;
      deletedInsts.forEach((inst: any) => toBeLoadedDbIds.push(inst.dbId));
    }
    if (toBeLoadedDbIds.length > 0) {
      return this.dataService.fetchInstances(toBeLoadedDbIds);
    }
    return of<Instance[]>([]);
  }

}

