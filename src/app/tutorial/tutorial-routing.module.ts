import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TutorialPageComponent } from './components/tutorial-page/tutorial-page.component';

const routes: Routes = [
  {
    path: '',
    component: TutorialPageComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TutorialRoutingModule {}
