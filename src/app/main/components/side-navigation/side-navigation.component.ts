import {Component, Input} from '@angular/core';
import {Instance} from "../../../core/models/reactome-instance.model";

@Component({
  selector: 'app-side-navigation',
  templateUrl: './side-navigation.component.html',
  styleUrls: ['./side-navigation.component.scss']
})
export class SideNavigationComponent {
  @Input() showUpdatedList: boolean = false;
  @Input() data: Instance[] = [];
}
