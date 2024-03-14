import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'curator-tool-frontend';
  loggedIn: string | null = "false";
  
  // This is a hack to show different views at the top. We should use angular route to manage these views!
  current_view: string = 'home_view';

  constructor(private router: Router) {}


  ngOnInit() {
    // this.loggedIn = sessionStorage.getItem('authenticated');
    // Bypass for the time being
    this.loggedIn = "true";
    this.router.navigate(["/home"]);
  }

  switch_view(view: any) {
    this.current_view = view;
    // Another hack to show something here
    if (this.current_view === 'schema_view') {
      this.router.navigate(['/table/DatabaseObject'])
    }
  }

}

