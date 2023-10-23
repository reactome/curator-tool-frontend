import {Component, OnInit, ViewChild} from '@angular/core';
import {DataService} from "../../../core/services/data.service";
import {InstanceList} from "../../../core/models/schema-class-instance-list.model";
import {ActivatedRoute} from "@angular/router";
import {MatTableDataSource, MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatInputModule} from "@angular/material/input";

@Component({
  selector: 'app-list-instances',
  templateUrl: './list-instances.component.html',
  styleUrls: ['./list-instances.component.scss'],
  standalone: true,
  imports: [MatTableModule, MatToolbarModule, MatPaginatorModule, MatInputModule]
})
export class ListInstancesComponent implements OnInit{
  displayedColumns: string[] = ['dbId','displayName'];
  dataSource: InstanceList[] = [];
  matDataSource = new MatTableDataSource<InstanceList>();

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  constructor(private dataService: DataService, private route: ActivatedRoute) {}

  className: any = "";

  ngOnInit(): void {

    this.route.params.subscribe((className) => {
      this.className = className
      this.dataService.listInstances(this.className.className).subscribe(listInstances => {
          this.dataSource = listInstances;
          this.matDataSource = new MatTableDataSource<InstanceList>(this.dataSource);
          this.matDataSource.paginator = this.paginator;
        }
      )
    })
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.matDataSource.filter = filterValue.trim().toLowerCase();
  }
}
