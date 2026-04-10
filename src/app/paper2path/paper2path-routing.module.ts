import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Paper2pathComponent } from './paper2path.component';

const routes: Routes = [
  {
    path: '',
    component: Paper2pathComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class Paper2pathRoutingModule { }