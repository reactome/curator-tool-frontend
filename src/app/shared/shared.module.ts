import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaPanelComponent } from './layout/schema-panel/schema-panel.component';
import { PipeNameComponent } from './pipes/pipe-name/pipe-name.component';
import { MaterialModule } from '../material/material.module';



@NgModule({
  declarations: [
    SchemaPanelComponent,
    PipeNameComponent
  ],
  imports: [
    CommonModule,
    MaterialModule
  ],
  exports: [MaterialModule]
})
export class SharedModule { }
