import {Component, Input, OnInit} from '@angular/core';
import {NgFor, NgIf} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {AttributeData} from 'src/app/core/models/schema-class-attribute-data.model';
import {Store} from '@ngrx/store';
import {selectAttributeData} from '../../state/attribute-table.selectors';
import {AttributeTableActions} from '../../state/attribute-table.actions';
import {EMPTY, Observable} from 'rxjs';
import {ActivatedRoute} from "@angular/router";

@Component({
  selector: 'app-attribute-table',
  templateUrl: './attribute-table.component.html',
  styleUrls: ['./attribute-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor],
})
export class AttributeTableComponent implements OnInit{
  displayedColumns: string[] = ['attributeName', 'cardinality', 'valueType', 'attributeOrigin'];
  dataSource$: Observable<AttributeData[]> = EMPTY;
  clickedRows = new Set<AttributeData>();
  constructor(
    private store: Store, private route: ActivatedRoute) {}
  className: any = "";

  ngOnInit(): void {
    this.route.params.subscribe((className) => {
      this.className = className
      this.dataSource$ = this.store.select(selectAttributeData(this.className.className))
      this.fetchAttributeTableByClassName(this.className.className);
    })  }

  fetchAttributeTableByClassName(className: string) {
    this.store.dispatch(AttributeTableActions.get({className: className}) );
  }
}
