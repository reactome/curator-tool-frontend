import { Component, OnInit } from '@angular/core';
import {NgIf, NgFor, CommonModule} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import { DataService } from 'src/app/core/services/data.service';
import { EntriesData } from 'src/app/core/models/entity-dataset.model';
import { KeyValuePair } from 'src/app/core/models/key-value.model';
import { Observable } from 'rxjs';
import {MatButtonModule} from "@angular/material/button";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule} from "@angular/material/select";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatInputModule} from "@angular/material/input";
import { Store } from '@ngrx/store';
import { EntriesTableActions } from '../../state/entries-table.actions';
import { selectEntriesData, selectSchemaClassArray } from '../../state/entries-table.selectors';
import { AttributeData } from 'src/app/core/models/fetch-dataset.model';
import { selectAttributeData } from 'src/app/attribute-table/state/attribute-table.selectors';
import { AttributeTableActions } from 'src/app/attribute-table/state/attribute-table.actions';
import { SchemaClassData } from 'src/app/core/models/schema-class.model';

@Component({
  selector: 'app-entries-table',
  templateUrl: './entries-table.component.html',
  styleUrls: ['./entries-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, CommonModule, MatButtonModule, MatSlideToggleModule, MatFormFieldModule, MatSelectModule, FormsModule, ReactiveFormsModule, MatInputModule],
})
export class EntriesTableComponent implements OnInit{
    displayedColumns: string[] = ['attribute', 'value'];
    dataSource$: Observable<KeyValuePair[]> = this.store.select(selectEntriesData());
    attributeData$: Observable<SchemaClassData[]>
     = this.store.select(selectSchemaClassArray());
    test: SchemaClassData[] = [];
    displayName: string ='';
    clickedRows = new Set<EntriesData>();
    constructor(private dataService: DataService, private store: Store) {}
  
    ngOnInit(): void {
      //this.store.dispatch({type: AttributeTableActions.GET_ATTRIBUTE_DATA, className: "Polymer"});
      this.store.dispatch({type: EntriesTableActions.GET_ENTRIES_DATA, dbId: "5619084"});
      console.log("here")
      console.log(this.attributeData$)
    }
}
