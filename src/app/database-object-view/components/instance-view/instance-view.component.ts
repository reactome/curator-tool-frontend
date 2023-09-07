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
export class InstanceViewComponent implements OnInit{
  menuHeader: any = [];
  mainNavigation: string = '8876883';
  counter: number = 0;
  className: string = '';
  addToHeader: boolean = true;
  dbId: string = '';
  updatedDataSource: DatabaseObject[] = [];
  originalDataSource:  DatabaseObject[] = [];
  newDataSource: DatabaseObject[] = [];

  constructor(private router: Router, private route: ActivatedRoute, private store: Store) {}

  ngOnInit() {
  }

  setClassName(data: any){
    if(this.addToHeader) {
      if (this.counter === 0) {
        this.mainNavigation = data
      } else {
        this.menuHeader.push(data)
      }
      this.counter++;
    }
    this.addToHeader = true;
  }

  getClassName(className: string) {
    this.className = className;
  }

  changeTable(dbId: string) {
    this.router.navigate(["/properties-table/" + dbId]);
    this.setClassName(this.className);
    this.addToHeader = false;
    //TODO: currently have classname, would be nice to have displayName
  }

  addRelationship(className: string) {
    this.menuHeader.push(className)
  }

  // Currently working on this logic.
  updateMainTable(data: any){
    console.log('here')
    this.store.select(selectDatabaseObjectData(this.dbId)).subscribe(
      data => {
        this.originalDataSource = data;
      }
    );

    let index = this.originalDataSource.findIndex(key => key.key === data.key)
    console.log(index)
    if(index === -1)
    {
      this.newDataSource = this.originalDataSource.map((item) => ({
        ...item,
      }))
      this.newDataSource.push(data);
      console.log(this.newDataSource)
    }
    else
    {
      this.originalDataSource.at(index)!.value = data.value;
    }
  }

  onSubmit(){
    this.store.dispatch(DatabaseObjectActions.modify({dbId: this.dbId, databaseObjectInput: this.newDataSource}));
  }

}
