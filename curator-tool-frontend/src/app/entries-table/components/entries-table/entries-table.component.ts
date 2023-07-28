import {AfterViewInit, Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {EMPTY, map, Observable} from 'rxjs';
import {Store} from '@ngrx/store';
import {EntriesTableActions} from '../../state/entries-table.actions';
import {selectSchemaClassArray} from '../../state/entries-table.selectors';
import {SchemaClassData} from 'src/app/core/models/schema-class-entry-data.model';
import {AttributeTableActions} from 'src/app/attribute-table/state/attribute-table.actions';
import {MatTableDataSource} from "@angular/material/table";
import {MatSort} from "@angular/material/sort";

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
  @Input() className: string = 'Polymer';
  @Input() dbId: string = '8876883';


  constructor(private store: Store) {
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort!;
  }


  onClick(row: number) {
    this.showToolBar[row] = !this.showToolBar[row];
  }

  ngOnInit(): void {
    this.store.dispatch({type: AttributeTableActions.GET_ATTRIBUTE_DATA, className: this.className});
    this.store.dispatch({type: EntriesTableActions.GET_ENTRIES_DATA, dbId: this.dbId});

    this.dataSource$ = selectSchemaClassArray(this.store, this.dbId, this.className).pipe(
      map(data => {
        this.dataSource.data = data
        return this.dataSource;
      })
    );
  }
}
