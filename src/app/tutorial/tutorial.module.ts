import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TutorialRoutingModule } from './tutorial-routing.module';
import { TutorialPageComponent } from './components/tutorial-page/tutorial-page.component';
import { SharedModule } from '../shared/shared.module';
import { StatusModule } from '../status/status.module';

@NgModule({
  declarations: [TutorialPageComponent],
  imports: [
    CommonModule,
    RouterModule,
    SharedModule,
    StatusModule,
    TutorialRoutingModule,
  ],
})
export class TutorialModule {}
