import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TextCurationComponent } from './components/text-curation.component';

const routes: Routes = [
  {
    path: "",
    component: TextCurationComponent
  },
  {
    path: "**",
    component: TextCurationComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
    TextCurationComponent
  ],
  exports: [RouterModule]
})
export class TextCurationRoutingModule { }
