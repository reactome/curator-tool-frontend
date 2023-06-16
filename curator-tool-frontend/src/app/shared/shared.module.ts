import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaPanelComponent } from './layout/schema-panel/schema-panel.component';
import { PipeNameComponent } from './pipes/pipe-name/pipe-name.component';



@NgModule({
  declarations: [
    SchemaPanelComponent,
    PipeNameComponent
  ],
  imports: [
    CommonModule
  ]
})
export class SharedModule { }
