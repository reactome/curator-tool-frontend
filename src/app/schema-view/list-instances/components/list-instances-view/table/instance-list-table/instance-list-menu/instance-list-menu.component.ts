import { Component, EventEmitter, Input, Output } from '@angular/core';


@Component({
  selector: 'app-instance-list-menu',
  templateUrl: './instance-list-menu.component.html',
  styleUrls: ['./instance-list-menu.component.scss'],
})
export class InstanceListMenuComponent {
  //@Output() actionItem = new EventEmitter<>();
  hidePanel: boolean = false;

  constructor() {
  }

  onClick() {
    // this.actionItem.emit(editAction);
    // this.hidePanel = true;
  }

  // Emit
  // createNewInstance(schemaClassName: string) {
  //   this.service.createNewInstance(schemaClassName).subscribe(instance => {
  //     this.service.registerInstance(instance);
  //     this.store.dispatch(NewInstanceActions.register_new_instance(this.instUtils.makeShell(instance)));
  //     let dbId = instance.dbId.toString();
  //     this.router.navigate(["/schema_view/instance/" + dbId]);
  //   });
  // }

}
