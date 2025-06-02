import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatTableDataSource } from "@angular/material/table";
import { map } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';

//instance will be passed into the dialog

interface SingleAttribute {
  columnName: string,
  value: string
}

@Component({
  selector: 'qa-report-table',
  templateUrl: './qa-report-table.component.html',
  styleUrls: ['./qa-report-table.component.scss']
})
export class QAReportTable implements OnInit {
  setNavigationUrl(_t14: any) {
    throw new Error('Method not implemented.');
  }
  @Input() rows: string[][] = [];
  @Input() colNames: string[] = [];

  dataSource!: MatTableDataSource<any>;
  displayedColumns: string[] = this.colNames;

  ngOnInit() {
    if (this.rows.length === 0 || this.colNames.length === 0) {
      // console.warn("No data provided for the table.");
      return;
    }
    const transformedData = this.doubleArrayToDataSource(this.rows, this.colNames);
    this.dataSource = new MatTableDataSource(transformedData);
  }

  doubleArrayToDataSource(data: any[][], columnNames: string[]): any[] {
    return data.map(innerArray => {
      const obj: any = {};
      innerArray.forEach((value, index) => {
        if (value.startsWith("{\"dbId\":")) 
          value = JSON.parse(value) as Instance;
        obj[columnNames[index]] = value;
      });
      return obj;
    });
  }

  navigate(dbId: string) {
    // This needs to be update by configuring
    window.open(`schema_view/instance/${dbId}`, '_blank');
  }
}
