import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusComponent } from './status/status.component';



@NgModule({
  declarations: [
    StatusComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    StatusComponent // Have to export it!!!
  ]
})
export class StatusModule { }
