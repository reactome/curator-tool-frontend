import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute } from "@angular/router";
import { Store } from '@ngrx/store';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaAttribute
} from "../../../core/models/reactome-schema.model";
import { SchemaClassTableActions } from './state/schema-class-table.actions';
import { getSchemaClass } from './state/schema-class-table.selectors';

@Component({
  selector: 'app-table',
  templateUrl: './schema-class-table.component.html',
  styleUrls: ['./schema-class-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor, TitleCasePipe],
})

//TODO: Enhance the table display so that it is more like 
// https://curator.reactome.org/cgi-bin/classbrowser?DB=gk_central&CLASS=ModifiedResidue
export class SchemaClassTableComponent implements OnInit {
  displayedColumns: string[] = ['name','type', 'category', 'allowedClasses', 'attributeOrigin', 'cardinality', 'definingType'];
  dataSource: SchemaAttribute[] = [];

  constructor(
    private store: Store, private route: ActivatedRoute) {
  }

  className: any = "";

  ngOnInit(): void {
    this.route.params.subscribe((clsNameParams) => {
      this.store.dispatch(SchemaClassTableActions.get({className: clsNameParams['className']}));
    });

    this.store.select(getSchemaClass()).subscribe((schemaClass) => {
      this.dataSource = schemaClass.attributes || [];
      }
    );
  }

  protected readonly AttributeDefiningType = AttributeDefiningType;
  protected readonly AttributeDataType = AttributeDataType;
  protected readonly AttributeCategory = AttributeCategory;
}
