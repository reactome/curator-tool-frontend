import {AfterViewInit, Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {EMPTY, map, Observable, take} from 'rxjs';
import {Store} from '@ngrx/store';
import {DatabaseObjectActions} from '../../state/database-object.actions';
import {selectSchemaClassArray, selectSchemaClassAttributes} from '../../state/database-object.selectors';
import {SchemaClassData} from 'src/app/core/models/schema-class-entry-data.model';
import {MatTableDataSource} from "@angular/material/table";
import {MatSort} from "@angular/material/sort";
import {ActivatedRoute} from "@angular/router";
import {AttributeTableActions} from "../../../attribute-table/state/attribute-table.actions";
import {DatabaseObject} from "../../../core/models/database-object-attribute.model";

@Component({
  selector: 'app-properties-table',
  templateUrl: './properties-table.component.html',
  styleUrls: ['./properties-table.component.scss'],
})
export class PropertiesTableComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['name', 'value'];
  dataSource = new MatTableDataSource<SchemaClassData>();
  unfilteredData: SchemaClassData[] = [];
  showFilterOptions: boolean = false;
  dbId: string = "";
  row: {} = {};
  newDatabaseObjectValues: DatabaseObject[] = [];

  categories: { [name: string]: boolean } = {
    "MANDATORY": false,
    "OPTIONAL": false,
    "REQUIRED": false,
    "NOMANUALEDIT": false
  };

  @ViewChild(MatSort) sort?: MatSort;
  @Input() className: string = '';
  @Input() relationshipDbId: string = '';
  @Output() newItemEvent = new EventEmitter<any>();
  @Output() newEntryTableEvent = new EventEmitter<any>();
  @Output() getClassNameEvent = new EventEmitter<string>();
  @Output() addRelationshipEvent = new EventEmitter<string>();
  @Output() updateDatasourceEvent = new EventEmitter<any>();

  constructor(private store: Store, private route: ActivatedRoute) {
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort!;
  }

  getClassName(displayName: string) {
    this.getClassNameEvent.emit(displayName);
  }

  showFilter() {
    this.showFilterOptions = !this.showFilterOptions;
    // this.dataSource.filter = '';
  }

  doFilter() {
    console.log('do filter', this.categories)
    this.dataSource.data = Object.values(this.categories).every(selected => !selected) ?
      this.unfilteredData :
      this.unfilteredData.filter(row => this.categories[row.category[1]]);
  }

  setRow(data: any) {
    this.store.dispatch(DatabaseObjectActions.modify({dbId: this.dbId, databaseObjectInput: data}));
  }

  setNewValue(data: any) {
    this.updateDatasourceEvent.emit(data);
  }

  ngOnInit(): void {
    // If the router param is a dbId, perform query for that dbOject,
    this.route.params.subscribe((params) => {
      if (params['dbId']) {
        this.dbId = params['dbId'];
        this.store.dispatch(DatabaseObjectActions.get({dbId: this.dbId}));
        this.newItemEvent.emit(this.dbId);
        selectSchemaClassArray(this.store, this.dbId)
          .subscribe(data => {
              this.unfilteredData = data;
              this.dataSource.data = data
            }
          );
      }

      // otherwise a blank table for the schema is created
      if (params['className']) {
        this.className = params['className'];
        console.log(this.className)
        this.addRelationshipEvent.emit(this.className);
        this.store.dispatch(AttributeTableActions.get({className: this.className}));
        this.store.select(selectSchemaClassAttributes(this.className))
          .subscribe(data => {
            this.unfilteredData = data;
            this.dataSource.data = data
          })
        console.log('data' + this.dataSource.data);
      }
    })
  }

}
