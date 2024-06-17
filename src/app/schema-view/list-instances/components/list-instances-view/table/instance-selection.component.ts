import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { PageEvent } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { combineLatest } from 'rxjs';
import { Instance } from "../../../../../core/models/reactome-instance.model";
import { DataService } from "../../../../../core/services/data.service";
import { ViewOnlyService } from "../../../../../core/services/view-only.service";
import {SchemaAttribute, SchemaClass} from "../../../../../core/models/reactome-schema.model";
import {ActivatedRoute} from "@angular/router";

@Component({
  selector: 'app-instance-selection',
  templateUrl: './instance-selection.component.html',
  styleUrls: ['./instance-selection.component.scss'],
})
export class InstanceSelectionComponent implements OnInit {
  matDataSource = new MatTableDataSource<Instance>();
  skip: number = 0;
  // For doing search
  searchKey: string | undefined = undefined;
  pageSizeOptions = [20, 50, 100];
  @Input() pageSize: number = 50;
  pageIndex: number = 0;
  className: string = "";
  instanceCount: number = 0;
  selected: number = 0; //move
  showProgressSpinner: boolean = true;
  @Output() clickEvent = new EventEmitter<Instance>();
  @Input() isSelection: boolean = false;
  data: Instance[] = [];
  actionButtons: string[] = ["launch"];
  schemaClasses: SchemaClass[] = [];
  schemaClassAttributes: SchemaAttribute[] = [];

  @Input() set setClassName(inputClassName: string) {
    this.className = inputClassName;
    this.skip = 0;
    this.pageIndex = 0;
    this.showProgressSpinner = true;
    this.loadInstances();
  }

  @Input() attributes: Array<string> = [];
  @Input() attributeTypes: Array<string> = [];
  @Input() regex: Array<string> = [];
  @Input() searchKeys: Array<string> = [];

  constructor(private dataService: DataService, private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.skip = 0;
    this.pageIndex = 0;
    this.showProgressSpinner = true;
    this.queryParams();
    this.loadInstances();
    this.loadSchemaClasses();
    console.log('data', this.data)
  }

  loadInstances() {
    console.log(this.attributes, this.regex, this.searchKeys)
      this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey)
    .subscribe((instancesList) => {
        this.instanceCount = instancesList.totalCount;
        this.showProgressSpinner = false;
        this.data = instancesList.instances;
        this.matDataSource.data = instancesList.instances;

      }
    )
  }

  loadSchemaClasses() {
    this.dataService.fetchSchemaClass(this.className).subscribe(att => {
      this.schemaClassAttributes = att.attributes!;
    });
    console.log("attributes", this.schemaClassAttributes);
    this.dataService.fetchSchemaClassTree().subscribe(schemaClass => {
      this.schemaClasses.push(schemaClass);
    })
  }

  searchForName(event: Event) {
    this.skip = 0;
    this.pageIndex = 0;
    this.loadInstances();
  }

  recordSearchKey(event: Event) {
    const text = (event.target as HTMLInputElement).value;
    this.searchKey = text;
    // Make sure reset it to undefined if nothing there so that
    // no empty string sent to the server
    if (this.searchKey !== undefined && this.searchKey.length === 0) {
      this.searchKey = undefined;
    }
  }

  onPageChange(pageObject: PageEvent) {
    this.skip = pageObject.pageIndex * pageObject.pageSize;
    this.pageSize = pageObject.pageSize;
    this.pageIndex = pageObject.pageIndex;
    this.loadInstances();
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId
    this.clickEvent.emit(row)
  }

  handleAction(actionButton: {instance: Instance, action: string}) {
    switch(actionButton.action) {
      case "launch": {
        this.navigate(actionButton.instance);
      }
    }
  }

  navigate(instance: Instance) {
    window.open(`instance_view/${instance.dbId}?${ViewOnlyService.KEY}=true`, '_blank');
  }

  queryParams() {
    this.route.params.subscribe((params) => {
      console.log('name from view', params['className'].toString())
      this.className = params['className'];
      this.attributes = params['attributes'];
      this.attributeTypes = params['attributeTypes'];
      this.regex = params['regex'];
      this.searchKey = params['searchKey'];
    });

    this.dataService.searchInstances(this.className, this.skip, this.pageSize, this.attributes, this.regex, this.searchKeys)
      .subscribe(instanceList => {
        this.instanceCount = instanceList.totalCount;
        this.data = instanceList.instances;
        this.matDataSource.data = instanceList.instances;
        this.showProgressSpinner = false;
      })
  }

  filterData(searchFilters: Array<string[]>) {
    console.log('searchFilters', searchFilters)
    this.showProgressSpinner = true;
    this.attributes = searchFilters[2];
    this.regex = searchFilters[3];
    this.searchKeys = searchFilters[4];

    this.dataService.searchInstances(this.className, this.skip, this.pageSize, this.attributes, this.regex, this.searchKeys)
      .subscribe(instanceList => {
        this.instanceCount = instanceList.totalCount;
        this.data = instanceList.instances;
        this.matDataSource.data = instanceList.instances;
        this.showProgressSpinner = false;
    })
    this.loadSchemaClasses();
  }
}
