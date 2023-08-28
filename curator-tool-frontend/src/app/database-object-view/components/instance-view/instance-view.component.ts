import { Component } from '@angular/core';
import {Router} from "@angular/router";
@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss']
})
export class InstanceViewComponent {
  menuHeader: any = [];
  mainNavigation: string = '8876883';
  counter: number = 0;
  className: string = '';
  addToHeader: boolean = true;
  constructor(private router: Router) {}

  setClassName(data: any){
    if(this.addToHeader) {
      if (this.counter === 0) {
        this.mainNavigation = data
      } else {
        console.log(data)
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

}
