import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Observable} from 'rxjs';
import {Store} from '@ngrx/store';
import {EntriesTableActions} from '../../state/entries-table.actions';
import {selectSchemaClassArray} from '../../state/entries-table.selectors';
import {SchemaClassData} from 'src/app/core/models/schema-class-entry-data.model';
import {AttributeTableActions} from 'src/app/attribute-table/state/attribute-table.actions';

@Component({
  selector: 'app-entries-table',
  templateUrl: './entries-table.component.html',
  styleUrls: ['./entries-table.component.scss'],
})
export class EntriesTableComponent implements OnInit {
  displayedColumns: string[] = ['attribute', 'value'];
  dataSource$: Observable<SchemaClassData[]> = selectSchemaClassArray(this.store);
  showToolBar: boolean[] = [];
  row: {} = {};
  @Input() className: string = 'Polymer';
  @Input() dbId: string = '8876883';


  constructor(private store: Store) {
  }

  onClick(row: number) {
    this.showToolBar[row] = !this.showToolBar[row];
  }

  ngOnInit(): void {
    this.store.dispatch({type: AttributeTableActions.GET_ATTRIBUTE_DATA, className: this.className});
    this.store.dispatch({type: EntriesTableActions.GET_ENTRIES_DATA, dbId: this.dbId});
  }
}
