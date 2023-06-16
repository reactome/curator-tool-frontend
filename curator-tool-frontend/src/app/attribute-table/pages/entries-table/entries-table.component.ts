import { Component, OnInit, Input } from '@angular/core';
import {NgIf, NgFor} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {HttpClient} from '@angular/common/http';
import { DataSource } from '@angular/cdk/collections';

export interface EntriesData {
  displayName: string;
  dbId: number;
  stId: string;
}

@Component({
  selector: 'app-entries-table',
  templateUrl: './entries-table.component.html',
  styleUrls: ['./entries-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor],
})
export class EntriesTableComponent implements OnInit{
  displayedColumns: string[] = ['displayName', 'dbId', 'stId'];
  displayName: string | undefined;
  dbId: number | undefined;
  stId: number | undefined;
  
  dataSource = this.http.get<any>('http://localhost:8080/api/curation/findByDbId/109581')
  .subscribe((data) => {
    this.displayName = data.displayName;
    console.log(this.displayName);
    this.dbId = data.dbId;
    console.log(this.dbId);
    this.stId = data.stId;
    console.log(this.stId);
  });
  clickedRows = new Set<EntriesData>();
  constructor(private http: HttpClient) {}

  ngOnInit() {
		// API Call
		this.http
			.get<any>('http://localhost:8080/api/curation/findByDbId/109581')
			.subscribe(data => {
				console.log(data);
			});
      //console.log("in comp" + this.item);
	}
}