import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule, Routes} from "@angular/router";
import {MainComponent} from "./main.component";
import { TextCurationComponent } from './components/text-curation/text-curation.component';

const routes: Routes = [
  {
    path: ``,
    component: TextCurationComponent
  }
]

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MainRoutingModule {}
