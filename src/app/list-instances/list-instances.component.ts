import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {DataService} from "../core/services/data.service";
import {InstanceList} from "../core/models/schema-class-instance-list.model";
import {ActivatedRoute, RouterLink} from "@angular/router";
import {MatTableDataSource, MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatInputModule} from "@angular/material/input";
import {SchemaClass} from "../core/models/reactome-schema.model";

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
  limit: number = 0;
  className: any = "";

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;
  
  constructor(private dataService: DataService, private route: ActivatedRoute) {
  }

  ngAfterViewInit() {
    this.matDataSource.paginator = this.paginator;
    this.paginator.length = this.limit;
  }

  ngOnInit(): void {
    this.route.params.subscribe((className) => {
      this.className = className;
      // this.findSchemaClassNode(this.className);
      this.dataService.listInstances(this.className.className, this.skip, 20).subscribe(listInstances => {
        this.matDataSource.data = listInstances;
        // Based on this: https://www.freakyjolly.com/angular-material-12-server-side-table-pagination-example/
        // Use timeout to reset the paginator.
        setTimeout(() => {
          this.paginator.pageIndex = 0;
          this.paginator.length = this.dataService.getInstanceCount(this.className.className);
        });
      })
    });
  }

  findSchemaClassNode(schemaClass: SchemaClass) {
    if (schemaClass.name === this.className.className) {
      this.limit = schemaClass.count!
    } else {
      if (schemaClass.children) {
        for (let child of schemaClass.children) {
          this.findSchemaClassNode(child)
        }
      }
    }
  }


  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.matDataSource.filter = filterValue.trim().toLowerCase();
  }

  onPageChange(pageObject: {}) {
    // this.skip = 5;
    console.log('onchange' + pageObject)
  }
}
