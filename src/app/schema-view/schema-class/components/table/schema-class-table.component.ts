import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSort, MatSortHeader, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ActivatedRoute } from "@angular/router";
import { Store } from '@ngrx/store';
import { DataService } from 'src/app/core/services/data.service';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaClass
} from "../../../../core/models/reactome-schema.model";

@Component({
  selector: 'app-table',
  templateUrl: './schema-class-table.component.html',
  styleUrls: ['./schema-class-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, MatSortModule, NgIf, NgFor, TitleCasePipe, MatSort, MatSortHeader],
})

//TODO: Enhance the table display so that it is more like
// https://curator.reactome.org/cgi-bin/classbrowser?DB=gk_central&CLASS=ModifiedResidue
export class SchemaClassTableComponent implements OnInit {
  displayedColumns: string[] = ['name', 'type', 'category', 'allowedClases', 'origin', 'cardinality', 'definingType'];
  dataSource: any;

  constructor(private store: Store, private route: ActivatedRoute, private dataService: DataService) {
  }

  @ViewChild(MatSort) sort: MatSort | undefined;

  className: any = "";

  ngOnInit(): void {
    this.route.params.subscribe((clsNameParams) => {
      const className = clsNameParams['className'];
      this.dataService.fetchSchemaClass(className).subscribe((schemaClass: SchemaClass) => {
        // Do a sort first
        let sorted_attributes = [...schemaClass.attributes!];
        sorted_attributes.sort((a, b) => a.name.localeCompare(b.name));
        this.dataSource = new MatTableDataSource(sorted_attributes);
        this.dataSource.sort = this.sort;
      }
      );
    }
    );
  }

  protected readonly AttributeDefiningType = AttributeDefiningType;
  protected readonly AttributeDataType = AttributeDataType;
  protected readonly AttributeCategory = AttributeCategory;
}
