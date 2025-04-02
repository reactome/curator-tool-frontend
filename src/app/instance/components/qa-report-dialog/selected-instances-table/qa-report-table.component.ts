import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatTableDataSource } from "@angular/material/table";
import { map } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';

//instance will be passed into the dialog
interface RowElement {
  att: SingleAttribute[];
}

interface SingleAttribute {
  columnName: string,
  value:  string
}

@Component({
  selector: 'qa-report-table',
  templateUrl: './qa-report-table.component.html',
  styleUrls: ['./qa-report-table.component.scss']
})
export class QAReportTable implements OnInit{

  @Input() rows: string[][] = [];
  @Input() colNames: string[] = [];

  dataSource!: MatTableDataSource<any>;
  displayedColumns: string[] = this.colNames;

  ngOnInit(){
    const transformedData = this.doubleArrayToDataSource(this.rows, this.colNames);
    this.dataSource = new MatTableDataSource(transformedData);
    console.log(this.dataSource);
  }

doubleArrayToDataSource(data: any[][], columnNames: string[]): any[] {
  return data.map(innerArray => {
    const obj: any = {};
    innerArray.forEach((value, index) => {
      obj[columnNames[index]] = value;
    });
    return obj;
  });
}

navigate(instance: Instance) {
  // This needs to be update by configuring
  window.open("instance_view/" + instance.dbId + true, '_blank');
}
}
