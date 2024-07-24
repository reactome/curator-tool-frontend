import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {Instance, InstanceList, Referrer} from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { AttributeValue } from '../instance-view/instance-table/instance-table.model';
import { Store } from '@ngrx/store';
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import {ViewOnlyService} from "../../../core/services/view-only.service";

/**
 * A dialog component that is used to create a new Instance object.
 *
 * <b>Note</b>: It is just too complexity to use rxjs store to manage new instance creation.
 * Here, we will use the data service directly.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './referrers-dialog.component.html',
  styleUrls: ['./referrers-dialog.component.scss']
})
export class ReferrersDialogComponent {
  selected: string = '';
  instanceList: Referrer[] = [];
  actionButtons: string[] = ["launch"];

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public instance: Instance,
              public dialogRef: MatDialogRef<ReferrersDialogComponent>,
              private dataService: DataService) {
    this.dataService.getReferrers(instance.dbId).subscribe(referrers => {
      console.log(referrers),
        this.instanceList = referrers;
    })
    // simpleRef.forEach( ref => {
        //   let simpleInstances: Instance[] = [];
        //   for(let databaseInst of ref.objects) {
        //     let  simpleInstance: Instance = {
        //       schemaClassName: databaseInst.schemaClass,
        //       dbId: databaseInst.dbId,
        //       displayName: databaseInst.displayName}
        //     simpleInstances.push(simpleInstance);
        //   }
        //   let referrer: Referrer = {schemaClassName: ref.referral, instances: simpleInstances};
        //   referrers.push(referrer);
        // })
  }

  onSelectionChange(): void {
    console.log('selected' + this.selected)
    this.dataService.createNewInstance(this.selected).subscribe(instance => {
        this.instance = instance;
      }
    );
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    // Just return the instance newly created. Don't close it. The template
    // will handle close.
    if (this.instance) {
      this.dataService.registerNewInstance(this.instance);
    }
    this.dialogRef.close(this.instance);
  }

  handleAction(actionEvent: { instance: Instance; action: string }) {
    switch(actionEvent.action) {
      case "launch": {
        const dbId = actionEvent.instance.dbId;
        window.open(`schema_view/instance/${dbId}?${ViewOnlyService.KEY}=true`, '_blank');
      }
    }
  }
}
