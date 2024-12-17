import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { DeleteInstanceActions, UpdateInstanceActions, NewInstanceActions } from 'src/app/instance/state/instance.actions';
import { Instance, UserInstances } from './core/models/reactome-instance.model';
import { DataService } from './core/services/data.service';
import { BookmarkActions } from './schema-view/instance-bookmark/state/bookmark.actions';
import { defaultIfEmpty, finalize } from 'rxjs';
import { InstanceUtilities } from './core/services/instance.service';
import { UserInstancesService } from './auth/login/user-instances.service';
import { AuthenticateService } from './core/services/authenticate.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'curator-tool-frontend';
  
  // This is a hack to show different views at the top. We should use angular route to manage these views!
  current_view: string = 'home_view';

  constructor(private userInstancesService: UserInstancesService
  ) {}

  ngOnInit() {
    this.userInstancesService.loadUserInstances();
  }
}

