import { Component, OnInit, Input } from '@angular/core';
import {NgIf, NgFor} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeData } from 'src/app/core/models/fetch-dataset.model';

@Component({
  selector: 'app-attribute-table',
  templateUrl: './attribute-table.component.html',
  styleUrls: ['./attribute-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor],
})
export class AttributeTableComponent implements OnInit{
  displayedColumns: string[] = ['attributeName', 'cardinality', 'valueType', 'attributeOrigin'];
  dataSource: AttributeData[] = [];
  clickedRows = new Set<AttributeData>();
  constructor(private dataService: DataService) {}
  @Input()  className: string = "";

	ngOnInit() {
    this.dataService.fetchAttributeData("Polymer")
        .subscribe(data => this.dataSource = data);
	}
}