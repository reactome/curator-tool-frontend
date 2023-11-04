import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { ActivatedRoute } from "@angular/router";
import { Instance } from "../../../core/models/reactome-instance.model";
import { DataService } from "../../../core/services/data.service";
import { concatMap } from 'rxjs';

@Component({
  selector: 'app-list-instances-table',
  templateUrl: './list-instances-table.component.html',
  styleUrls: ['./list-instances-table.component.scss'],
})
export class ListInstancesTableComponent implements OnInit {
  displayedColumns: string[] = ['dbId', 'displayName'];
  matDataSource = new MatTableDataSource<Instance>();
  skip: number = 0;
  // For doing search
  searchKey: string | undefined = undefined;
  pageSizeOptions = [20, 50, 100];
  pageSize: number = 20;
  className: any = "";
  pageIndex: number = 0;
  instanceCount: number = 0;
  @Input() inputClassName: string = "";
  @Input() isSelection: boolean = false;

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  constructor(private dataService: DataService, private route: ActivatedRoute) {
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

  loadInstances() {
    this.dataService.getInstanceCount(this.className, this.searchKey)
      .pipe(
        concatMap(count => {
          this.instanceCount = count;
          return this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey);
        })
      )
      .subscribe(
        (instanceList) => {
          this.matDataSource.data = instanceList;
          this.matDataSource.paginator = this.paginator;
          // Based on this: https://www.freakyjolly.com/angular-material-12-server-side-table-pagination-example/
          // Use timeout to reset the paginator.
          setTimeout(() => {
            this.paginator.pageIndex = this.pageIndex;
            this.paginator.pageSize = this.pageSize;
            this.paginator.length = this.instanceCount;
          });
        });
  }

  searchForName(event: Event) {
    this.skip = 0;
    this.pageIndex = 0;
    this.loadInstances();
  }

  recordSearchKey(event: Event) {
    const text = (event.target as HTMLInputElement).value;
    this.searchKey = text;
  }

  onPageChange(pageObject: PageEvent) {
    this.skip = pageObject.pageIndex * pageObject.pageSize;
    this.pageSize = pageObject.pageSize;
    this.pageIndex = pageObject.pageIndex;
    this.loadInstances();
  }
}
