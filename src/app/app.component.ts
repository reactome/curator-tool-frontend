import { Component } from '@angular/core';
import { UserInstancesService } from './auth/login/user-instances.service';

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

