import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatTableDataSource } from "@angular/material/table";
import { map } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';

//instance will be passed into the dialog

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
setNavigationUrl(_t14: any) {
throw new Error('Method not implemented.');
}
routerNavigationUrl: string = '';
onInstanceLinkClicked(_t14: any) {
throw new Error('Method not implemented.');
}

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
      if(value.startsWith("SimpleInstance")){
        const atts: any = {};
        value = value.replace("SimpleInstance ", "");
        value = value.slice(1, -1) // remove {}
        value.split(/,\s*/) // split by comma and optional space
        .forEach((part: { split: (arg0: string) => [any, any]; }) => {
          const [key, value] = part.split('=');
          const cleanedValue = value.trim().replace(/^'|'$/g, ''); // remove quotes if present
          atts[key.trim()] = isNaN(Number(cleanedValue)) ? cleanedValue : Number(cleanedValue);
        });
        value = atts
      }
      obj[columnNames[index]] = value;
    });
    return obj;
  });
}

navigate(dbId: string) {
  // This needs to be update by configuring
  window.open("/schema_view/instance/" + dbId.toString());
}
}
