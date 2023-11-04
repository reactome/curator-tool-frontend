import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { ActivatedRoute } from "@angular/router";
import { Instance } from "../../../core/models/reactome-instance.model";
import { DataService } from "../../../core/services/data.service";

@Component({
  selector: 'app-list-instances-table',
  templateUrl: './list-instances-table.component.html',
  styleUrls: ['./list-instances-table.component.scss'],
})
export class ListInstancesTableComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['dbId', 'displayName'];
  matDataSource = new MatTableDataSource<Instance>();
  skip: number = 0;
  // For doing search
  searchKey: string|undefined = undefined;
  pageSizeOptions = [20, 50, 100];
  pageSize: number = 20;
  className: any = "";
  pageIndex: number = 0;
  @Input() inputClassName: string = "";
  @Input() isSelection: boolean = false;

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  constructor(private dataService: DataService, private route: ActivatedRoute) {
  }

  ngAfterViewInit() {
    this.matDataSource.paginator = this.paginator;
    this.paginator.length = this.pageSize;
  }

  ngOnInit(): void {
    // console.log('inputClassName' + this.inputClassName)
    this.isSelection ? this.className = this.inputClassName && this.loadInstances() :
    this.route.params.subscribe((className) => {
      this.className = className;
      this.className = this.className.className;
      this.skip = 0;
      this.pageIndex = 0;
      this.loadInstances();
    });
  }

  //TODO: There is one error related to reset paginator in debug:
//   arg1:
// Error: NG0100: ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value: '0 of 0'. Current value: '1 – 20 of 20'. Find more at https://angular.io/errors/NG0100\n    at throwErrorIfNoChangesMode (http://localhost:4200/vendor.js:60050:9)\n    at bindingUpdated (http://localhost:4200/vendor.js:64222:9)\n    at interpolation1 (http://localhost:4200/vendor.js:64315:21)\n    at Module.ɵɵtextInterpolate1 (http://localhost:4200/vendor.js:67460:24)\n    at MatPaginator_Template (http://localhost:4200/vendor.js:102309:71)\n    at executeTemplate (http://localhost:4200/vendor.js:61929:5)\n    at refreshView (http://localhost:4200/vendor.js:61813:7)\n    at refreshComponent (http://localhost:4200/vendor.js:62827:7)\n    at refreshChildComponents (http://localhost:4200/vendor.js:61611:5)\n    at refreshView (http://localhost:4200/vendor.js:61863:7) {code: -100, stack: 'Error: NG0100: ExpressionChangedAfterItHasB… (http://localhost:4200/vendor.js:61863:7)', …}
// handleError @ /Users/wug/git/reactome/curator-tool-frontend/node_modules/@angular/core/fesm2020/core.mjs:8400:23
  loadInstances(){
    this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey).subscribe(instanceList => {
      this.matDataSource.data = instanceList;
      // Based on this: https://www.freakyjolly.com/angular-material-12-server-side-table-pagination-example/
      // Use timeout to reset the paginator.
      setTimeout(() => {
        this.paginator.pageIndex = this.pageIndex;
        this.paginator.pageSize = this.pageSize;
        this.dataService.getInstanceCount(this.className, this.searchKey).subscribe(count => this.paginator.length = count)
      });
    })
  }

  searchForName(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.skip = 0;
    this.pageIndex = 0;
    this.searchKey = filterValue;
    this.loadInstances();
  }

  onPageChange(pageObject: PageEvent) {
    this.skip = pageObject.pageIndex * pageObject.pageSize;
    this.pageSize = pageObject.pageSize;
    this.pageIndex = pageObject.pageIndex;
    this.loadInstances();
  }
}
