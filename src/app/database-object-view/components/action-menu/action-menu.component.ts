import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {map} from "rxjs";
import {toClassName} from "../../../core/models/schema-class-attribute-data.model";
import {DatabaseObjectActions} from "../../state/database-object.actions";
import {Store} from "@ngrx/store";
import {DatabaseObject, Type} from "../../../core/models/database-object-attribute.model";
import {DataService} from "../../../core/services/data.service";
import {selectDatabaseObjectData} from "../../state/database-object.selectors";
import {Router} from "@angular/router";

export interface User {
  name: string;
}

@Component({
  selector: 'app-action-menu',
  templateUrl: './action-menu.component.html',
  styleUrls: ['./action-menu.component.scss'],
})
export class ActionMenuComponent implements OnInit {
  @Input() row: any = {};
  @Input() dbId: string = '';
  dataSource$: DatabaseObject[] = [];
  @Output() setRow = new EventEmitter<DatabaseObject[]>();
  showPanel: boolean = false;
  value: DatabaseObject[] = [];
  className: string = '';
  data: {} = {};
  updateDataSource: DatabaseObject[] = [];
  newDbId: number = -1;

  constructor(private store: Store, private dataService: DataService, private router: Router) {
  }

  ngOnInit() {
    this.dataService.fetchDatabaseObjectData('71033').pipe(
      map(databaseObject => this.value = databaseObject)
    );
    console.log('value' + this.value)

    this.store.select(selectDatabaseObjectData(this.dbId)).subscribe(
      data => {
        this.dataSource$ = data;
      }
    );

    this.className = toClassName(this.row.properties.attributeClasses[0].type)
  }

  newDatabaseObject() {
    let id: DatabaseObject = {key: 'dbId', value: this.newDbId, type:'number', javaType:""}
    let displayName: DatabaseObject= {key:"displayName", value:"Display Name will be auto-generated", type:"string", javaType:""}
    let stId: DatabaseObject = {key:"stId", value: "R-HSA-", type:"string", javaType:""}
    let databaseObjectInput: DatabaseObject[] = [id, displayName, stId];
    this.store.dispatch(DatabaseObjectActions.add({dbId: this.newDbId.toString(), databaseObjectInput: databaseObjectInput}));
    this.router.navigate(["/properties-table/" + this.newDbId]);
    this.newDbId--;
  }

  onSubmit() {
    // TODO: move this code into the instance view
    // Determine if the current databaseObject contains the attribute
    // that is being assigned a value
    let index = this.dataSource$.findIndex(key => key.key === this.row.name)
    //If the attribute is not found in the array of database-object-attributes
    //the index is -1 and the attribute will be added as a database-object-attribute to the array
    if (index === -1) {
      // the ngrx entity is immutable so the values are copied to a new DatabaseObject[]
      this.updateDataSource = this.dataSource$.map((item) => ({
        ...item,
      }))
      this.updateDataSource.push({
        key: this.row.name,
        value: {
          "@JavaClass": "org.reactome.server.graph.domain.model.InstanceEdit",
          "dbId": 71033,
          "displayName": "2003-04-11 00:00:00",
          "dateTime": "2003-04-11 04:00:00"
        },
        type: this.row.type,
        javaType: this.row.javaType
      });
    }
    // if there is an index, get the index to reset the value.
    else {
      this.dataSource$.at(index)!.value = this.value;
    }
    //this.setRow.emit(this.updateDataSource)
    this.store.dispatch(DatabaseObjectActions.modify({dbId: this.dbId, databaseObjectInput: this.updateDataSource}));
  }
}
