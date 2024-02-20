import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'curator-tool-frontend';
  loggedIn: string | null = "false";
  ngOnInit() {
    this.loggedIn = sessionStorage.getItem('authenticated');
  }
}

