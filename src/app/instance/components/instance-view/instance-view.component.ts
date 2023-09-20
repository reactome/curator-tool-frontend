import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from "@ngrx/store";
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { InstanceActions } from "../../state/instance.actions";
import { selectViewInstance } from '../../state/instance.selectors';

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.scss']
})
export class InstanceViewComponent implements OnInit {
  viewHistory: any = [];
  // instance to be displayed
  instance: Instance | undefined;

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
      if (this.instance.dbId !== 0 && !this.viewHistory.includes(this.instance.dbId))
        this.viewHistory.push(this.instance.dbId);
    })
  }

  changeTable(dbId: string) {
    this.router.navigate(["/instance_view/" + dbId]);
  }

}
