import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Store} from "@ngrx/store";
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {InstanceActions} from "../../state/instance.actions";
import {selectViewInstance} from '../../state/instance.selectors';
import {CdkDragMove} from "@angular/cdk/drag-drop";

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss']
})
export class InstanceViewComponent implements OnInit {
  viewHistory: Instance[] = [];
  sideWidth = 385;
  dbIds: any = [];
  // instance to be displayed
  instance: Instance | undefined;
  showResize: boolean = false;
  resizing: boolean = false;

  constructor(private router: Router, private route: ActivatedRoute, private store: Store) {
  }

  ngOnInit() {
    // Use the route to get the dbId for the instance to be displayed
    this.route.params.subscribe((params) => {
      if (params['dbId']) {
        let dbId = params['dbId'];
        // Make sure dbId is a number
        dbId = parseInt(dbId);
        this.store.dispatch(InstanceActions.get_instance({dbId: dbId}));
      }
    });
    // Get the view instance to be displayed here
    this.store.select(selectViewInstance()).subscribe(instance => {
      this.instance = instance;
      if (this.instance.dbId !== 0 && !this.dbIds.includes(this.instance.dbId))
        this.viewHistory.push(this.instance);
      this.dbIds.push(this.instance.dbId)
    })
  }

  changeTable(instance: Instance) {
    this.router.navigate(["/instance_view/" + instance.dbId.toString()]);
  }

  resize(e: CdkDragMove) {
      this.sideWidth = e.pointerPosition.x
  }

  changeShowResize(){this.showResize = !this.showResize}
}
