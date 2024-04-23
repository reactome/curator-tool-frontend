import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ActivatedRoute } from "@angular/router";
import { Store } from '@ngrx/store';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType
} from "../../../../core/models/reactome-schema.model";
import { SchemaClassTableActions } from './state/schema-class-table.actions';
import { getSchemaClass } from './state/schema-class-table.selectors';
import { MatSort, MatSortHeader, MatSortModule } from '@angular/material/sort';

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
  displayedColumns: string[] = ['name','type', 'category', 'allowedClasses', 'attributeOrigin', 'cardinality', 'definingType'];
  dataSource: any;

  constructor(private store: Store, private route: ActivatedRoute) {
  }

  @ViewChild(MatSort) sort: MatSort|undefined;

  className: any = "";

  ngOnInit(): void {
    this.route.params.subscribe((clsNameParams) => {
      this.store.dispatch(SchemaClassTableActions.get({className: clsNameParams['className']}));
    });

    this.store.select(getSchemaClass()).subscribe((schemaClass) => {
      this.dataSource = new MatTableDataSource(schemaClass.attributes)
      this.dataSource.sort = this.sort;
      }
    );
  }

  protected readonly AttributeDefiningType = AttributeDefiningType;
  protected readonly AttributeDataType = AttributeDataType;
  protected readonly AttributeCategory = AttributeCategory;
}
