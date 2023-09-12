import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {DatabaseObject} from "../../../core/models/database-object-attribute.model";
import {Store} from "@ngrx/store";
import {DatabaseObjectActions} from "../../state/database-object.actions";
import {selectDatabaseObjectData} from "../../state/database-object.selectors";

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss']
})
export class InstanceViewComponent implements OnInit {
  menuHeader: any = [];
  mainNavigation: string = '8876883';
  counter: number = 0;
  className: string = '';
  addToHeader: boolean = true;
  dbId: string = '';
  newRelationship: DatabaseObject[] = [];
  originalDataSource: DatabaseObject[] = [];
  newDataSource: DatabaseObject[] = [];
  row: any = {};

  constructor(private router: Router, private route: ActivatedRoute, private store: Store) {
  }

  ngOnInit() {
  }

  setClassName(data: any) {
    if (this.addToHeader) {
      if (this.counter === 0) {
        this.mainNavigation = data
      } else {
        this.menuHeader.push(data)
      }
      this.counter++;
    }
    this.addToHeader = true;
  }

  setRow(data: any) {
    this.row = data;
    console.log('row' + this.row.name)
  }

  getClassName(className: string) {
    this.className = className;
  }

  changeTable(dbId: string) {
    this.router.navigate(["/instance-table/" + dbId]);
    this.setClassName(this.className);
    this.addToHeader = false;
    //TODO: currently have classname, would be nice to have displayName
  }

  addRelationship(className: string) {
    this.menuHeader.push(className)
  }

  // Currently working on this logic.
  updateMainTable(data: any) {
  }

  onSubmit() {
    this.store.select(selectDatabaseObjectData("-1")).subscribe(
      data => {
        this.newRelationship = data;
      }
    );
    this.store.select(selectDatabaseObjectData(this.mainNavigation)).subscribe(
      data => {
        this.originalDataSource = data;
      }
    );
    this.newDataSource = this.originalDataSource.map((item) => ({
      ...item,
    }))

    console.log(this.row.name)

    this.newDataSource.push(
      {
        key: this.row.name, // in this case author
        value: {
          "@JavaClass": "org.reactome.server.graph.domain.model.InstanceEdit",
          "dbId": 71033,
          "displayName": "2003-04-11 00:00:00",
          "dateTime": "2003-04-11 04:00:00"
        },
        type: this.row.type, // type of author
        javaType: this.row.javaType // java type of author
      }
    );

    this.store.dispatch(DatabaseObjectActions.modify({
      dbId: this.mainNavigation,
      databaseObjectInput: this.newDataSource
    }));
    this.router.navigate(["/instance-table/" + this.mainNavigation]);
  }

}
