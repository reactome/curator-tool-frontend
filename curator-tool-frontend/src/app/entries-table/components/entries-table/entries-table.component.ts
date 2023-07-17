import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { EntriesTableActions } from '../../state/entries-table.actions';
import { selectSchemaClassArray } from '../../state/entries-table.selectors';
import { SchemaClassData } from 'src/app/core/models/schema-class-entry-data.model';
import { AttributeTableActions } from 'src/app/attribute-table/state/attribute-table.actions';
import {DataService} from "../../../core/services/data.service";

@Component({
  selector: 'app-entries-table',
  templateUrl: './entries-table.component.html',
  styleUrls: ['./entries-table.component.scss'],
})
export class EntriesTableComponent implements OnInit{
    displayedColumns: string[] = ['attribute', 'value'];
    dataSource$: Observable<SchemaClassData[]>
     = this.store.select(selectSchemaClassArray());
    hoveredRows = Observable<SchemaClassData>
    showToolBar: boolean[] = [];
    row: {} = {};
  constructor(private store: Store, private ds: DataService) {}

    onMouseEnter(row: number){
    //this.row = row.name;
      this.showToolBar[row] = !this.showToolBar[row];
      console.log(row)}
    //onMouseOut(row: SchemaClassData){this.showToolBar = false;}

    ngOnInit(): void {
      this.store.dispatch({type: AttributeTableActions.GET_ATTRIBUTE_DATA, className: "Polymer"});
      this.store.dispatch({type: EntriesTableActions.GET_ENTRIES_DATA, dbId: "8876883"});
      console.log(this.ds.fetchSchemaClasses());
    }
}
