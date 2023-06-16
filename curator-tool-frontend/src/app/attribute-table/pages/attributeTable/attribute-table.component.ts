import { Component, OnInit, Input } from '@angular/core';
import {NgIf, NgFor} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {HttpClient} from '@angular/common/http';
import { DataService } from 'src/app/core/services/data.service';
import {Observable} from "rxjs";

export interface AttributeData {
  name: string;
  // cardinality: string | undefined;
  // valueType: string | undefined;
  // attributeOrigin: string;
}

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
  constructor(private http: HttpClient, private dataService: DataService) {}
  //@Input() dataSource = Array<AttributeData>;

	ngOnInit() {
    this.dataService.fetchExampleData("Polymer")
        .subscribe(data => this.dataSource = data);
	}
}