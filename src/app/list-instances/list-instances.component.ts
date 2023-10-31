import {Component, OnInit, ViewChild} from '@angular/core';
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
export class ListInstancesComponent implements OnInit {
  displayedColumns: string[] = ['dbId', 'displayName'];
  dataSource: InstanceList[] = [];
  matDataSource = new MatTableDataSource<InstanceList>();
  skip: number = 0;
  pageSizeOptions = [20, 50, 100];
  limit: number = 0;

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  constructor(private dataService: DataService, private route: ActivatedRoute) {
  }

  className: any = "";

  ngOnInit(): void {

    this.route.params.subscribe((className) => {
      this.className = className

      this.dataService.fetchSchemaClassTree().subscribe(data => {
        this.findSchemaClassNode(data);

        this.dataService.listInstances(this.className.className, this.skip, 20).subscribe(listInstances => {
            this.dataSource = listInstances;
            this.matDataSource = new MatTableDataSource<InstanceList>(this.dataSource);
            this.paginator.length = 500;
            this.matDataSource.paginator = this.paginator;
          }
        )
      })
    })
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
