import {Component, Input, OnInit} from '@angular/core';
import {NgFor, NgIf} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {AttributeData} from 'src/app/core/models/schema-class-attribute-data.model';
import {Store} from '@ngrx/store';
import {selectAttributeData} from '../../state/attribute-table.selectors';
import {AttributeTableActions} from '../../state/attribute-table.actions';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-attribute-table',
  templateUrl: './attribute-table.component.html',
  styleUrls: ['./attribute-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor],
})
export class AttributeTableComponent implements OnInit{
  displayedColumns: string[] = ['attributeName', 'cardinality', 'valueType', 'attributeOrigin'];
  dataSource$: Observable<AttributeData[]> = this.store.select(selectAttributeData('Polymer'));
  clickedRows = new Set<AttributeData>();
  constructor(
    private store: Store) {}
  @Input()  className: string = "Polymer";

  ngOnInit(): void {
    this.store.dispatch(AttributeTableActions.get({className: this.className}));
  }
}
