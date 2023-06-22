import { Component, OnInit } from '@angular/core';
import {NgIf, NgFor, CommonModule} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import { DataService } from 'src/app/core/services/data.service';
import { EntriesData, EntriesTableData } from 'src/app/core/models/entity-dataset.model';
import { KeyValuePair } from 'src/app/core/models/key-value.model';
import { Observable } from 'rxjs';
import {MatButtonModule} from "@angular/material/button";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule} from "@angular/material/select";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";

@Component({
  selector: 'app-entries-table',
  templateUrl: './entries-table.component.html',
  styleUrls: ['./entries-table.component.scss'],
  standalone: true,
  imports: [MatTableModule, CommonModule, MatButtonModule, MatSlideToggleModule, MatFormFieldModule, MatSelectModule, FormsModule, ReactiveFormsModule],
})
export class EntriesTableComponent implements OnInit{
    displayedColumns: string[] = ['attribute', 'value'];
    dataSource$: Observable<KeyValuePair[]> = this.dataService.fetchEntityData("976871");
    test: Object | undefined;
    displayName: string ='';
    clickedRows = new Set<EntriesData>();
    constructor(private dataService: DataService) {}
  
    ngOnInit() {
    }
}