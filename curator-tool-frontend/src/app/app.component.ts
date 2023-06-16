import { Component, OnInit } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AttributeData {
  name: string;
  cardinality: string | undefined;
  valueType: string | undefined;
  attributeOrigin: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'curator-tool-frontend';
  ngOnInit() {
  }
}

