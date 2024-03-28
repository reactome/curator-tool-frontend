import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {CommonModule} from '@angular/common';
import {EventTableComponent} from './event-table.component';

const routes: Routes = [
  {
    path: `:className`,
    component: EventTableComponent
  }
]
@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    EventTableComponent
  ],
  exports: [RouterModule]
})
export class EventTableRoutingModule {
}
