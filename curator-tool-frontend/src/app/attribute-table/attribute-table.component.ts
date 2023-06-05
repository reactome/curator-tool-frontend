import { Component, OnInit } from '@angular/core';
import {NgIf, NgFor} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {HttpClient, HttpHeaders} from '@angular/common/http';

export interface PathwayData {
  origin: string;
  definingType: string;
  category: string;
  name: string;
}

const PATHWAY_DATA: PathwayData[] = [
{
    origin: "org.reactome.server.graph.domain.model.Event",
    definingType: "UNDEFINED",
    category:"REQUIRED",
    name: "testName1"},
{
    origin: "org.reactome.server.graph.domain.model.Event",
    definingType: "UNDEFINED",
    category:"OPTIONAL",
    name: "testName2"},
{
    origin:"org.reactome.server.graph.domain.model.Event",
    definingType:"UNDEFINED",
    category:"MANDATORY",
    name: "testName3"}]

@Component({
  selector: 'app-attribute-table',
  templateUrl: './attribute-table.component.html',
  styleUrls: ['./attribute-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, NgIf, NgFor],
})
export class AttributeTableComponent implements OnInit{
  displayedColumns: string[] = ['origin', 'definingType', 'category', 'name'];
  dataSource = PATHWAY_DATA;
  clickedRows = new Set<PathwayData>();
  constructor(private http: HttpClient) {}

	ngOnInit() {
		// API Call
		this.http
			.get<any>('http://localhost:8080/api/curation/getAttributes/Pathway')
			.subscribe(data => {
				console.log(data);
			});
	}
}