import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { PageEvent } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { combineLatest } from 'rxjs';
import { Instance } from "../../../../../core/models/reactome-instance.model";
import { DataService } from "../../../../../core/services/data.service";
import { ViewOnlyService } from "../../../../../core/services/view-only.service";
import {SchemaAttribute, SchemaClass} from "../../../../../core/models/reactome-schema.model";
import {ActivatedRoute} from "@angular/router";
import {
  AttributeCondition
} from "../../../../../shared/components/search-filter/attribute-condition/attribute-condition.component";

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
  schemaClassAttributes: string[] = [];

  @Input() set setClassName(inputClassName: string) {
    this.className = inputClassName;
    this.skip = 0;
    this.pageIndex = 0;
    this.showProgressSpinner = true;
    this.loadInstances();
  }

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
      att.attributes?.forEach(attr => {
        this.schemaClassAttributes.push(attr.name);
      });
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
      console.log('name from view', params)
      this.className = params['className'];
      let attributes = params['attributes'];
      let regex = params['regex'];
      let searchKey = params['searchKey'];
      this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributes, regex, searchKey)
        .subscribe(instanceList => {
          this.instanceCount = instanceList.totalCount;
          this.data = instanceList.instances;
          this.matDataSource.data = instanceList.instances;
          this.showProgressSpinner = false;
        })
    });
  }

  filterData(searchFilters: AttributeCondition[]) {
    console.log('searchFilters', searchFilters)
    this.showProgressSpinner = true;
    let attributeNames: string[] = [];
    let regex: string[] = [];
    let searchKeys: string[] = [];
    for(let attributeCondition of searchFilters) {
      attributeNames.push(attributeCondition.attributeName);
      regex.push(attributeCondition.operand);
      searchKeys.push(attributeCondition.searchKey);
      console.log(attributeCondition);
    }

    this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributeNames, regex, searchKeys)
      .subscribe(instanceList => {
        this.instanceCount = instanceList.totalCount;
        this.data = instanceList.instances;
        this.matDataSource.data = instanceList.instances;
        this.showProgressSpinner = false;
    })
    this.loadSchemaClasses();
  }
}
