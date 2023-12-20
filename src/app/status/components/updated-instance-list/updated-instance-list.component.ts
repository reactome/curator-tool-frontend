import {Component, Input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxChange, MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatTableModule} from '@angular/material/table';
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {Router} from "@angular/router";
import {ListInstancesModule} from "../../../list-instances/list-instances.module";

@Component({
  selector: 'app-updated-instance-list',
  templateUrl: './updated-instance-list.component.html',
  styleUrls: ['./updated-instance-list.component.scss'],
  standalone: true,
  imports: [MatListModule, MatButtonModule, MatTableModule, MatIconModule, MatCheckboxModule, ListInstancesModule],
})
export class UpdatedInstanceListComponent {
  @Input() data: Instance[] = [];
  // instances to be committed
  toBeUploaded: Instance[] = [];
  actionButtons: string[] = ["compare"];
  isSelection: boolean = true;

  constructor(private router: Router,) {
    this.toBeUploaded = [...this.data];
  }

  compareWithDB(instance: Instance) {
    this.router.navigate(["/instance_view/", instance.dbId, "comparison"]);
  }

  onSelectionChange(instance: Instance, event: MatCheckboxChange) {
    let index = this.toBeUploaded.indexOf(instance);
    if (event.checked) {
      if (index < 0)
        this.toBeUploaded.push(instance);
    } else {
      if (index > -1)
        this.toBeUploaded.splice(index, 1);
    }
    console.debug('Instances to be uploaded: ' + this.toBeUploaded.length);
  }

  handleAction(actionButton: { instance: Instance, action: string }) {
    switch (actionButton.action) {
      case "compare": {
        this.compareWithDB(actionButton.instance)
        break;
      }
    }
  }
}
