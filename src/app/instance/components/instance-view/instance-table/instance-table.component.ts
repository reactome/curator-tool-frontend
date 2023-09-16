import { AfterViewInit, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { ActivatedRoute } from "@angular/router";
import { Store } from '@ngrx/store';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { SchemaClassInstanceData } from 'src/app/core/models/schema-class-entry-data.model';
import { DatabaseObject } from "../../../../core/models/database-object-attribute.model";
import { SchemaClassTableActions } from "../../../../schema-class-table/state/schema-class-table.actions";
import { DatabaseObjectActions } from '../../../state/instance.actions';
import {
  selectDatabaseObjectData,
  selectSchemaClassArray,
  selectSchemaClassAttributes
} from '../../../state/instance.selectors';
import { AttributeValue, InstanceDataSource } from './instance-table.model';

@Component({
  selector: 'app-instance-table',
  templateUrl: './instance-table.component.html',
  styleUrls: ['./instance-table.component.scss'],
})
export class InstanceTableComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['name', 'value'];
  dataSource = new MatTableDataSource<SchemaClassInstanceData>();
  unfilteredData: SchemaClassInstanceData[] = [];
  showFilterOptions: boolean = false;
  dbId: string = "";
  row: {} = {};
  newDatabaseObjectValues: SchemaClassInstanceData[] = [];

  categories: { [name: string]: boolean } = {
    "MANDATORY": false,
    "OPTIONAL": false,
    "REQUIRED": false,
    "NOMANUALEDIT": false
  };

  @ViewChild(MatSort) sort?: MatSort;
  @Input() className: string = '';
  @Input() relationshipDbId: string = '';

  // The instance to be displayed
  instanceDataSource : InstanceDataSource = new InstanceDataSource(undefined);
  // Keep it for editing
  _instance?: Instance;
  // Make sure it is bound to input instance
  @Input() set instance(instance: Instance | undefined) {
    this.instanceDataSource = new InstanceDataSource(instance);
    this._instance = instance;
  };
  
  @Output() newItemEvent = new EventEmitter<any>();
  @Output() newEntryTableEvent = new EventEmitter<any>();
  @Output() getClassNameEvent = new EventEmitter<string>();
  @Output() addRelationshipEvent = new EventEmitter<string>();
  @Output() updateDatasourceEvent = new EventEmitter<any>();
  @Output() setRowInstance = new EventEmitter<DatabaseObject[]>();
  copyDataSource: DatabaseObject[] = [];
  dataSource$: DatabaseObject[] = [];

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
    console.log('row ' + data.name)
    this.setRowInstance.emit(data)
  }

  onNewValue(data: AttributeValue) {
    console.debug('onNewValue: ', data);
    if (data.attribute.cardinality === '1') {
      this._instance?.attributes!.set(data.attribute.name, data.value);
    }
    else { // This should be a list
      let valueList = this._instance?.attributes!.get(data.attribute.name);
      if (valueList === undefined) {
        this._instance?.attributes!.set(data.attribute.name, [data.value]);
      }
      else {
        valueList[data.index!] = data.value;
      }
    }
  }

  setNewValue(data: string) {
    // console.debug('setNewValue: ', data);
    // // get the database object from the store
    // this.store.select(selectDatabaseObjectData(this.dbId)).subscribe(
    //   data => {
    //     this.dataSource$ = data;
    //   }
    // );

    // // the state is immutable, so make a copy
    // this.copyDataSource = this.dataSource$.map((item) => ({
    //   ...item,
    // }))

    // // Determine if the current databaseObject contains the attribute
    // // that is being assigned a value
    // let index = this.dataSource$.findIndex(key => key.key === data.key)

    // // If index is -1, the attribute does not exist on the object
    // if (index === -1) {
    //   this.copyDataSource.push(data);
    // }
    // // otherwise assign the value to the correct attribute
    // else {
    //   this.copyDataSource.at(index)!.value = data.value;
    // }

    // // dispatch the new datasource to the store
    // this.store.dispatch(DatabaseObjectActions.modify({dbId: this.dbId, databaseObjectInput: this.copyDataSource}));

    // //this.updateDatasourceEvent.emit(data);
  }

  ngOnInit(): void {
    // If the router param is a dbId, perform query for that dbOject,
    this.route.params.subscribe((params) => {
      if (params['dbId']) {
        this.dbId = params['dbId'];
        this.dbId === '-1' ? this.store.select(selectDatabaseObjectData(this.dbId)) :
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
        this.store.dispatch(SchemaClassTableActions.get({className: this.className}));
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