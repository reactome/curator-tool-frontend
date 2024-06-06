import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {map} from "rxjs/operators";

@Component({
  selector: 'app-list-instances-view',
  templateUrl: './list-instances-view.component.html',
  styleUrls: ['./list-instances-view.component.scss'],
})
export class ListInstancesViewComponent implements OnInit {
  schemaClassName: any = "";
  attributes: Array<string> = [];
  attributeTypes: Array<string> = [];
  regex: Array<string> = [];
  searchKey: Array<string> = [];

  constructor(private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      console.log('name from view', params['className'].toString())
      this.schemaClassName = params['className'];
      this.attributes = params['attributes'];
      this.attributeTypes = params['attributeTypes'];
      this.regex = params['regex'];
      this.searchKey = params['searchKey'];
    });
  }

}
