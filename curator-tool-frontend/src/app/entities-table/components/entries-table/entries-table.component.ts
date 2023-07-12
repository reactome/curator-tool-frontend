import { Component, OnInit } from '@angular/core';
import { CommonModule} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import { Observable } from 'rxjs';
import {MatButtonModule} from "@angular/material/button";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule} from "@angular/material/select";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatInputModule} from "@angular/material/input";
import { Store } from '@ngrx/store';
import { EntriesTableActions } from '../../state/entries-table.actions';
import { selectSchemaClassArray } from '../../state/entries-table.selectors';
import { SchemaClassData } from 'src/app/core/models/schema-class.model';
import { AttributeTableActions } from 'src/app/attribute-table/state/attribute-table.actions';
import {MatToolbarModule} from '@angular/material/toolbar';

@Component({
  selector: 'app-entries-table',
  templateUrl: './entries-table.component.html',
  styleUrls: ['./entries-table.component.scss'],
  // standalone: true,
  // imports: [MatTableModule, CommonModule, MatButtonModule, MatSlideToggleModule, MatFormFieldModule, MatSelectModule, FormsModule, ReactiveFormsModule, MatInputModule, MatToolbarModule],
})
export class EntriesTableComponent implements OnInit{
    displayedColumns: string[] = ['attribute', 'value'];
    dataSource$: Observable<SchemaClassData[]>
     = this.store.select(selectSchemaClassArray());
    hoveredRows = Observable<SchemaClassData>
    showToolBar: boolean = false;
    constructor(private store: Store) {}

    onMouseEnter(row: SchemaClassData){ this.showToolBar = true; console.log(this.showToolBar)}
    onMouseOut(row: SchemaClassData){this.showToolBar = false; console.log(this.showToolBar)}
  
    ngOnInit(): void {
      this.store.dispatch({type: AttributeTableActions.GET_ATTRIBUTE_DATA, className: "Polymer"});
      this.store.dispatch({type: EntriesTableActions.GET_ENTRIES_DATA, dbId: "8876883"});
    }
}
