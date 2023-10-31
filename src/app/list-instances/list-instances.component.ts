import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {DataService} from "../core/services/data.service";
import {InstanceList} from "../core/models/schema-class-instance-list.model";
import {ActivatedRoute, RouterLink} from "@angular/router";
import {MatTableDataSource, MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatPaginator, MatPaginatorModule, PageEvent} from "@angular/material/paginator";
import {MatInputModule} from "@angular/material/input";

@Component({
  selector: 'app-list-instances',
  templateUrl: './list-instances.component.html',
  styleUrls: ['./list-instances.component.scss'],
  standalone: true,
  imports: [MatTableModule, MatToolbarModule, MatPaginatorModule, MatInputModule, RouterLink]
})
export class ListInstancesComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['dbId', 'displayName'];
  matDataSource = new MatTableDataSource<InstanceList>();
  skip: number = 0;
  pageSizeOptions = [20, 50, 100];
  pageSize: number = 20;
  className: any = "";
  pageIndex: number = 0;

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  constructor(private dataService: DataService, private route: ActivatedRoute) {
  }

  ngAfterViewInit() {
    this.matDataSource.paginator = this.paginator;
    this.paginator.length = this.pageSize;
  }

  ngOnInit(): void {
    this.route.params.subscribe((className) => {
      this.className = className;
      this.setPaginator();
    });
  }

  setPaginator(){
    this.dataService.listInstances(this.className.className, this.skip, this.pageSize).subscribe(listInstances => {
      this.matDataSource.data = listInstances;
      // Based on this: https://www.freakyjolly.com/angular-material-12-server-side-table-pagination-example/
      // Use timeout to reset the paginator.
      setTimeout(() => {
        this.paginator.pageIndex = this.pageIndex;
        this.paginator.pageSize = this.pageSize;
        this.paginator.length = this.dataService.getInstanceCount(this.className.className);
      });
    })
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.matDataSource.filter = filterValue.trim().toLowerCase();
  }

  onPageChange(pageObject: PageEvent) {
    this.skip = pageObject.pageIndex * pageObject.pageSize;
    this.pageSize = pageObject.pageSize;
    this.pageIndex = pageObject.pageIndex;
    this.setPaginator();
  }
}
