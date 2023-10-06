import {Component, Input, OnInit} from '@angular/core';
import {NgFor, NgIf} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {SchemaClassData} from 'src/app/core/models/schema-class-attribute-data.model';
import {Store} from '@ngrx/store';
import {selectSchemaClassData} from '../../state/schema-class-table.selectors';
import {SchemaClassTableActions} from '../../state/schema-class-table.actions';
import {EMPTY, Observable} from 'rxjs';
import {ActivatedRoute} from "@angular/router";
import {SchemaAttribute, SchemaClass} from "../../../../../core/models/reactome-schema.model";

@Component({
  selector: 'app-table',
  templateUrl: './schema-class-table.component.html',
  styleUrls: ['./schema-class-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor],
})
export class SchemaClassTableComponent implements OnInit {
  displayedColumns: string[] = ['attributeName', 'cardinality', 'valueType', 'attributeOrigin'];
  dataSource: SchemaAttribute[] = [];
  clickedRows = new Set<SchemaClassData>();

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
}
