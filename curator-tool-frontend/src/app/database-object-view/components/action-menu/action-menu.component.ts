import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {FormControl} from "@angular/forms";
import {EMPTY, find, map, Observable, startWith} from "rxjs";
import {AttributeData, toClassName} from "../../../core/models/schema-class-attribute-data.model";
import {DatabaseObjectActions} from "../../state/database-object.actions";
import {Store} from "@ngrx/store";
import {DatabaseObject, Type} from "../../../core/models/database-object.model";
import {DataService} from "../../../core/services/data.service";
import {MatTableDataSource} from "@angular/material/table";
import {SchemaClassData} from "../../../core/models/schema-class-entry-data.model";
import {selectEntriesData, selectSchemaClassArray} from "../../state/database-object.selectors";
import {DatabaseObjectEntity} from "../../state/database-object.reducers";

export interface User {
  name: string;
}
@Component({
  selector: 'app-action-menu',
  templateUrl: './action-menu.component.html',
  styleUrls: ['./action-menu.component.scss'],
})
export class ActionMenuComponent implements OnInit{
  @Input() row: any = {};
  @Input() dbId: string = '';
  dataSource$: DatabaseObject[] = [];
  @Output() setRow = new EventEmitter<DatabaseObject[]>();
  myControl = new FormControl<string | User>('');
  options: User[] = [{name: 'David'}, {name: 'Shelley'}, {name: 'Igor'}];
  filteredOptions: Observable<User[]> = EMPTY;
  showPanel: boolean = false;
  value: DatabaseObject[] = [];
  className: string = '';
  data: {} = {};
  updateDataSource: DatabaseObject[] = [];

  constructor(private store: Store, private dataService: DataService) {}
  ngOnInit() {
    this.dataService.fetchEntityData('71033').pipe(
      map(databaseObject => this.value = databaseObject)
  );
    console.log('value' + this.value)

    this.store.select(selectEntriesData(this.dbId)).subscribe(
      data => {
        this.dataSource$ = data;
      }
    );

    this.className = toClassName(this.row.properties.attributeClasses[0].type)
    // console.log(this.className)
    // this.filteredOptions = this.myControl.valueChanges.pipe(
    //   startWith(''),
    //   map(value => {
    //     const name = typeof value === 'string' ? value : value?.name;
    //     return name ? this._filter(name as string) : this.options.slice();
    //   }),
    // );
  }

  showLookupPanel(){
    this.showPanel = !this.showPanel;
  }
  displayFn(user: User): string {
    return user && user.name ? user.name : '';
  }

  onSubmit() {
    let index = this.dataSource$.findIndex(key => key.key === this.row.name)
    console.log(this.row.name)
    if(index === -1)
    {
      this.updateDataSource = this.dataSource$.map((item) => ({
        ...item,
      }))
      this.updateDataSource.push({
        key: this.row.name,
        value: {"@JavaClass":"org.reactome.server.graph.domain.model.InstanceEdit","dbId":71033,"displayName":"2003-04-11 00:00:00","dateTime":"2003-04-11 04:00:00"},
        type: this.row.type,
        javaType: this.row.javaType});
    }
    else
    {
      this.dataSource$.at(index)!.value = this.value;
    }
    this.setRow.emit(this.updateDataSource)
    // this.store.dispatch(DatabaseObjectActions.modify({dbId: this.dbId, databaseObjectInput: this.updateDataSource}));
    //TODO; emit update event for table
  }

  private _filter(name: string): User[] {
    const filterValue = name.toLowerCase();

    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }

  toClassName(props: string) {
    if (!props) return '';
    let typeArray = props.split(".");
    let index = typeArray.length;
    return typeArray[index - 1];
  }

}
