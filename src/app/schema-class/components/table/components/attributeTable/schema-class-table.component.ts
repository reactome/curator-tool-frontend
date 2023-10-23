import {Component, Input, OnInit} from '@angular/core';
import {NgFor, NgIf, TitleCasePipe} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {Store} from '@ngrx/store';
import {selectSchemaClassData} from '../../state/schema-class-table.selectors';
import {SchemaClassTableActions} from '../../state/schema-class-table.actions';
import {EMPTY, Observable} from 'rxjs';
import {ActivatedRoute} from "@angular/router";
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaAttribute
} from "../../../../../core/models/reactome-schema.model";

@Component({
  selector: 'app-table',
  templateUrl: './schema-class-table.component.html',
  styleUrls: ['./schema-class-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor, TitleCasePipe],
})
export class SchemaClassTableComponent implements OnInit {
  displayedColumns: string[] = ['name','type', 'category', 'allowedClasses', 'attributeOrigin', 'cardinality', 'definingType'];
  dataSource: SchemaAttribute[] = [];

  constructor(
    private store: Store, private route: ActivatedRoute) {
  }

  className: any = "";

  ngOnInit(): void {
    this.route.params.subscribe((className) => {
      this.className = className
      this.store.select(selectSchemaClassData(this.className.className)).subscribe(schemaClass => {
        this.dataSource = schemaClass.attributes || [];
        }

      )
      this.fetchAttributeTableByClassName(this.className.className);
    })
  }

  fetchAttributeTableByClassName(className: string) {
    this.store.dispatch(SchemaClassTableActions.get({className: className}));
  }

  protected readonly AttributeDefiningType = AttributeDefiningType;
  protected readonly AttributeDataType = AttributeDataType;
  protected readonly AttributeCategory = AttributeCategory;
}
