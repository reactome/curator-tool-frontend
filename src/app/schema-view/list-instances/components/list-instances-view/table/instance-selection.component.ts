import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { PageEvent } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { Instance } from "../../../../../core/models/reactome-instance.model";
import { DataService } from "../../../../../core/services/data.service";
import { ViewOnlyService } from "../../../../../core/services/view-only.service";
import { ActivatedRoute, Router } from "@angular/router";
import { AttributeCondition } from '../../../../../core/models/reactome-instance.model';

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
  // schemaClasses: SchemaClass[] = [];
  schemaClassAttributes: string[] = [];
  // A flag to use route to load: use string so that we can set it directly in html
  @Input() useRoute: boolean = false;

  // TODO: There is NG0100 error here: ExpressionChagnedAfterCheckingError. setTimeOut fix cannot work here!!!
  @Input() set setClassName(inputClassName: string) {
      this.className = inputClassName;
      this.skip = 0;
      this.pageIndex = 0;
      this.showProgressSpinner = true;
      this.loadInstances();
  }

  constructor(private dataService: DataService, private router: Router, private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.skip = 0;
    this.pageIndex = 0;
    this.showProgressSpinner = true;
    this.loadInstances();
    this.loadSchemaClasses();
    console.log('data', this.data)
    // this.queryParams();
    // combineLatest([
    //   this.route.params,
    //   this.route.queryParams
    // ]).subscribe(([params, queryParams]) => {
    //   console.log('Params:', params);
    //   console.log('Query Params:', queryParams);
    //   // You can use params and queryParams here as needed
    // });
  }

  loadInstances() {
    // Make sure className is set!
    if (this.className && this.className.length > 0) {
      this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey)
        .subscribe((instancesList) => {
          this.instanceCount = instancesList.totalCount;
          this.showProgressSpinner = false;
          this.data = instancesList.instances;
          this.matDataSource.data = instancesList.instances;
        }
        )
    }
  }

  loadSchemaClasses() {
    // if (this.className && this.className.length > 0) {
    //   this.dataService.fetchSchemaClass(this.className).subscribe(att => {
    //     att.attributes?.forEach(attr => {
    //       this.schemaClassAttributes.push(attr.name);
    //     });
    //   });
    //   console.log("attributes", this.schemaClassAttributes);
    //   this.dataService.fetchSchemaClassTree().subscribe(schemaClass => {
    //     this.schemaClasses.push(schemaClass);
    //   })
    // }
  }

  searchForName(event: Event | undefined) {
    this.skip = 0;
    this.pageIndex = 0;
    if (this.useRoute) {
      let url = '/schema_view/list_instances/' + this.className + '/' + this.skip + '/' + this.pageSize;
      if (this.searchKey) // Here we have to use merge to keep all parameters there. This looks like a bug in Angular!!!
        this.router.navigate([url], {queryParams: {query: this.searchKey}, queryParamsHandling: 'merge'});
      else 
        this.router.navigate([url]);
    }
    else
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

  handleAction(actionEvent: {instance: Instance, action: string}) {
    switch(actionEvent.action) {
      case "launch": {
        const dbId = actionEvent.instance.dbId;
        window.open(`schema_view/instance/${dbId}?${ViewOnlyService.KEY}=true`, '_blank');
      }
    }
  }

  queryParams() {
    this.route.params.subscribe((params) => {
      console.log('name from view', params)
      this.className = params['className'];
      let attributes = params['attributes'];
      let operands = params['operands'];
      let searchKey = params['searchKey'];
      this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributes, operands, searchKey)
        .subscribe(instanceList => {
          this.instanceCount = instanceList.totalCount;
          this.data = instanceList.instances;
          this.matDataSource.data = instanceList.instances;
          this.showProgressSpinner = false;
        })
    });
  }

  /**
   * Search instances based on a set of search criteria.
   * @param searchFilters
   */
  searchInstances(searchFilters: AttributeCondition[]) {
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
