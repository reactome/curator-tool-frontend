import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ListInstancesComponent} from "./list-instances.component";
import {ListInstancesRoutingModule} from "./list-instances-routing.module";

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ListInstancesRoutingModule,
    ListInstancesComponent,
  ]
})
export class ListInstancesModule {
}
