import { Component, Input, Output } from '@angular/core';
import {SchemaClassData} from "../../../core/models/schema-class-entry-data.model";

@Component({
  selector: 'app-tool-bar',
  templateUrl: './tool-bar.component.html',
  styleUrls: ['./tool-bar.component.scss'],
})
export class ToolBarComponent {
  @Input() row: string = '';
  //@Output()

}
