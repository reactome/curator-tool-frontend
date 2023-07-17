import { Component, OnInit, Input } from '@angular/core';
import {NgIf, NgFor} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeData } from 'src/app/core/models/schema-class-attribute-data.model';
import { AttributeDataState } from '../../state/attribute-table.reducers';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectAttribute, selectAttributeData } from '../../state/attribute-table.selectors';
import { AttributeTableActions } from '../../state/attribute-table.actions';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-attribute-table',
  templateUrl: './attribute-table.component.html',
  styleUrls: ['./attribute-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor],
})
export class AttributeTableComponent implements OnInit{
  displayedColumns: string[] = ['attributeName', 'cardinality', 'valueType', 'attributeOrigin'];
  dataSource$: Observable<AttributeData[]> = this.store.select(selectAttributeData());
  clickedRows = new Set<AttributeData>();
  constructor(
    private store: Store) {}
  @Input()  className: string = "";

  ngOnInit(): void {
    this.store.dispatch({type: AttributeTableActions.GET_ATTRIBUTE_DATA, className: "Polymer"});
  }
}
