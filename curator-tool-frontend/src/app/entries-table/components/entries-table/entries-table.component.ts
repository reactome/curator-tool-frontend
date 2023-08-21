import {AfterViewInit, Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {EMPTY, map, Observable} from 'rxjs';
import {Store} from '@ngrx/store';
import {EntriesTableActions} from '../../state/entries-table.actions';
import {selectSchemaClassArray, selectSchemaClassAttributes} from '../../state/entries-table.selectors';
import {SchemaClassData} from 'src/app/core/models/schema-class-entry-data.model';
import {MatTableDataSource} from "@angular/material/table";
import {MatSort} from "@angular/material/sort";
import {ActivatedRoute} from "@angular/router";
import {AttributeTableActions} from "../../../attribute-table/state/attribute-table.actions";
@Component({
  selector: 'app-entries-table',
  templateUrl: './entries-table.component.html',
  styleUrls: ['./entries-table.component.scss'],
})
export class EntriesTableComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['name', 'value'];
  private dataSource = new MatTableDataSource<SchemaClassData>();
  dataSource$: Observable<MatTableDataSource<SchemaClassData>> = EMPTY;
  showFilterOptions: boolean = false;
  dbId: any = "";
  showToolBar: boolean[] = [];
  row: {} = {};
  @ViewChild(MatSort) sort?: MatSort;
  @Input() className: string = '';
  @Output() newItemEvent = new EventEmitter<any>();
  @Output() newEntryTableEvent = new EventEmitter<any>();
  @Output() getClassNameEvent= new EventEmitter<string>();

  constructor(private store: Store, private route: ActivatedRoute) {
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort!;
  }

  onClick(row: number) {
    this.showToolBar[row] = !this.showToolBar[row];
  }

  newEntryTable(newEntryTable: any){
    this.newEntryTableEvent.emit(newEntryTable);
  }

  getClassName(displayName: string){
    this.getClassNameEvent.emit(displayName);
  }

  showFilter() {
    this.showFilterOptions = !this.showFilterOptions;
  }

   doFilter(value: string) {
    this.dataSource.filter = value.trim().toLocaleLowerCase();
    // this.dataSource.filterPredicate()
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      if(params['dbId']){
      this.dbId = params['dbId'];
      this.store.dispatch({type: EntriesTableActions.GET_ENTRIES_DATA, dbId: this.dbId});
      this.newItemEvent.emit(this.dbId);

      this.dataSource$ = selectSchemaClassArray(this.store, this.dbId).pipe(
        map(data => {
          this.dataSource.data = data
          return this.dataSource;
        })
      );
    }
      if(params['className']){
        this.className = params['className'];
        console.log(this.className)
        this.store.dispatch(AttributeTableActions.get({className: this.className}) );
        this.dataSource$ = this.store.select(selectSchemaClassAttributes(this.className)).pipe(
          map(data => {
            this.dataSource.data = data
            console.log(data)
            return this.dataSource
          })
        );
      }
    })
    }

}
