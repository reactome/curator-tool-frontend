import {AfterViewInit, Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {EMPTY, map, Observable} from 'rxjs';
import {Store} from '@ngrx/store';
import {EntriesTableActions} from '../../state/entries-table.actions';
import {selectSchemaClassArray} from '../../state/entries-table.selectors';
import {SchemaClassData} from 'src/app/core/models/schema-class-entry-data.model';
import {MatTableDataSource} from "@angular/material/table";
import {MatSort} from "@angular/material/sort";
import {EntriesData} from "../../state/entries-table.reducers";

@Component({
  selector: 'app-entries-table',
  templateUrl: './entries-table.component.html',
  styleUrls: ['./entries-table.component.scss'],
})
export class EntriesTableComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['name', 'value'];
  private dataSource = new MatTableDataSource<SchemaClassData>();
  dataSource$: Observable<MatTableDataSource<SchemaClassData>> = EMPTY;

  @ViewChild(MatSort) sort?: MatSort;
  showToolBar: boolean[] = [];
  row: {} = {};
  test$: Observable<EntriesData | undefined> = EMPTY;
  @Input() className: string = '';
  @Input() dbId: string = '8876883';
  @Output() newItemEvent = new EventEmitter<any>();
  @Output() newEntryTableEvent = new EventEmitter<any>();
  @Output() getClassNameEvent= new EventEmitter<string>();

  constructor(private store: Store) {
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort!;
  }

  onClick(row: number) {
    // this.showToolBar[row] = !this.showToolBar[row];
  }

  newEntryTable(newEntryTable: any){
    this.newEntryTableEvent.emit(newEntryTable);
  }

  getClassName(className: string){
    this.getClassNameEvent.emit(className);
  }

  ngOnInit(): void {
    // this.store.dispatch({type: AttributeTableActions.GET_ATTRIBUTE_DATA, className: this.className});
    this.store.dispatch({type: EntriesTableActions.GET_ENTRIES_DATA, dbId: this.dbId});
    this.newItemEvent.emit(this.dbId);

    this.dataSource$ = selectSchemaClassArray(this.store, this.dbId).pipe(
      map(data => {
        this.dataSource.data = data
        return this.dataSource;
      })
    );
  }
}
