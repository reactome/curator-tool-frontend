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
  newRelationship: any = [];
  originalDataSource: DatabaseObject[] = [];
  copyDataSource: DatabaseObject[] = [];
  row: any = {};
  finalObj: {} = {};
  keyString: any = '';

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
        data.map((e: any) => {
          this.keyString = e.key;
          this.newRelationship = {key: e.key, value: e.value}});
        // data.map(e => this.newRelationship.push(
        //     e.key.toString() + ": " + e.value.toString()
        //   )
        // )
        console.log("nr" + this.newRelationship[0])
      }
  );

    this.store.select(selectDatabaseObjectData(this.mainNavigation)).subscribe(
      data => {
        this.originalDataSource = data;
        this.copyDataSource = this.originalDataSource.map((item) => ({
          ...item,
        }))
      }
    );

    this.copyDataSource.push(
      {
        key: this.row.name, // in this case author
        // value: {
        //   value: this.newRelationship
        // },
        value: this.newRelationship,
        type: this.row.type, // type of author
        javaType: this.row.javaType // java type of author
      }
    );

    this.store.dispatch(DatabaseObjectActions.modify({
      dbId: this.mainNavigation,
      databaseObjectInput: this.copyDataSource
    }));
    this.router.navigate(["/instance-table/" + this.mainNavigation]);
  }

}
