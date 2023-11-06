import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import { Component } from '@angular/core';

@Component({
  selector: 'app-list-instances-view',
  templateUrl: './list-instances-view.component.html',
  styleUrls: ['./list-instances-view.component.scss'],
})
export class ListInstancesViewComponent implements OnInit {
  schemaClassName: any = "";

  constructor(private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.route.params.subscribe((className) => {
      this.schemaClassName = className;
      this.schemaClassName = this.schemaClassName.className;
      console.log('name from view' + this.schemaClassName)
    });
  }

}
