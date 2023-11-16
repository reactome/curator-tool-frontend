import {AfterViewInit, Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {MatTableDataSource} from "@angular/material/table";
import {ActivatedRoute} from "@angular/router";
import {Instance} from "../../../../core/models/reactome-instance.model";
import {DataService} from "../../../../core/services/data.service";
import {combineLatest, concatMap, last} from 'rxjs';

@Component({
  selector: 'app-list-instances-table',
  templateUrl: './list-instances-table.component.html',
  styleUrls: ['./list-instances-table.component.scss'],
})
export class ListInstancesTableComponent implements OnInit {
  displayedColumns: string[] = ['dbId', 'displayName', 'viewInstance'];
  matDataSource = new MatTableDataSource<Instance>();
  skip: number = 0;
  // For doing search
  searchKey: string | undefined = undefined;
  pageSizeOptions = [20, 50, 100];
  pageSize: number = 20;
  pageIndex: number = 0;
  className: string = "";
  instanceCount: number = 0;
  selected: number = 0;
  showProgressSpinner: boolean = true;
  @Output() clickEvent = new EventEmitter<Instance>();
  @Input() isSelection: boolean = false;

  @Input() set setClassName(inputClassName: string) {
    this.className = inputClassName;
    this.skip = 0;
    this.pageIndex = 0;
    this.showProgressSpinner = true;
    this.loadInstances();
  }

  constructor(private dataService: DataService) {
  }

  ngOnInit(): void {
    this.skip = 0;
    this.pageIndex = 0;
    this.showProgressSpinner = true;
    this.loadInstances();
  }

  loadInstances() {
    combineLatest([
      this.dataService.getInstanceCount(this.className, this.searchKey),
      this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey)
    ]).subscribe(([count, instances]) => {
        this.instanceCount = count;
        this.matDataSource.data = instances;
        this.showProgressSpinner = false;
      }
    )
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

  click() {

  }
}
