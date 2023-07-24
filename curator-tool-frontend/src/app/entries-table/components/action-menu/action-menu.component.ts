import {Component, Input, OnInit, Output} from '@angular/core';
@Component({
  selector: 'app-action-menu',
  templateUrl: './action-menu.component.html',
  styleUrls: ['./action-menu.component.scss'],
})
export class ActionMenuComponent {
  @Input() row: string = '';
}
