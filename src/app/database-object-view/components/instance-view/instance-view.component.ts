import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { DatabaseObject } from "../../../core/models/database-object-attribute.model";
import { Store } from "@ngrx/store";
import { DatabaseObjectActions, InstanceActions } from "../../state/database-object.actions";
import { selectDatabaseObjectData } from "../../state/database-object.selectors";
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { selectViewInstance } from '../../state/database-object.selectors';

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss']
})
export class InstanceViewComponent implements OnInit {
  viewHistory: any = [];
  newRelationship: any = [];
  originalDataSource: DatabaseObject[] = [];
  copyDataSource: DatabaseObject[] = [];
  row: any = {};
  finalObj: {} = {};
  keyString: any = '';
  // instance to be displayed
  instance: Instance | undefined;

  constructor(private router: Router, private route: ActivatedRoute, private store: Store) {
  }

  ngOnInit() {
    // Use the route to get the dbId for the instance to be displayed
    this.route.params.subscribe((params) => {
      if (params['dbId']) {
        let dbId = params['dbId'];
        this.store.dispatch(InstanceActions.get_instance({dbId: dbId}));
      }
    });
    // Get the view instance to be displayed here
    this.store.select(selectViewInstance()).subscribe(instance => {
      this.instance = instance;
      if (this.instance.dbId !== 0 && !this.viewHistory.includes(this.instance.dbId))
        this.viewHistory.push(this.instance.dbId);
    })
  }

  setRow(data: any) {
    this.row = data;
    console.log('row' + this.row.name)
  }

  changeTable(dbId: string) {
    this.router.navigate(["/instance_view/" + dbId]);
  }

  addRelationship(className: string) {
    this.viewHistory.push(className)
  }

  // Currently working on this logic.
  updateMainTable(data: any) {
  }

  onSubmit() {
    // select the newly added instance from the store
    // currently also trying to map the values to newRelationship as object
    // this.store.select(selectDatabaseObjectData("-1")).subscribe(
    //   data => {
    //     data.map((e: any) => {
    //       this.keyString = e.key;
    //       this.newRelationship = { key: e.key, value: e.value }
    //     });
    //   }
    // );

    // // Select the main database object from the store
    // // the datasource is immutable, so a copy is made
    // this.store.select(selectDatabaseObjectData(this.mainNavigation)).subscribe(
    //   data => {
    //     this.originalDataSource = data;
    //     this.copyDataSource = this.originalDataSource.map((item) => ({
    //       ...item,
    //     }))
    //   }
    // );

    // // the newRelationship.value is in an incorrect format, so using an example
    // this.copyDataSource.push(
    //   {
    //     key: this.row.name,
    //     value: {
    //       "@JavaClass": "org.reactome.server.graph.domain.model.InstanceEdit",
    //       "dbId": 71033,
    //       "displayName": "2003-04-11 00:00:00",
    //       "dateTime": "2003-04-11 04:00:00"
    //     },
    //     //value: this.newRelationship,
    //     type: this.row.type,
    //     javaType: this.row.javaType
    //   }
    // );

    // // dispatch the changes to the store
    // this.store.dispatch(DatabaseObjectActions.modify({
    //   dbId: this.mainNavigation,
    //   databaseObjectInput: this.copyDataSource
    // }));
    // this.router.navigate(["/instance-table/" + this.mainNavigation]);
  }

}
