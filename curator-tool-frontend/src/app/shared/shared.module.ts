import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaPanelComponent } from './layout/schema-panel/schema-panel.component';
import { DirectiveNameComponent } from './directive/directive-name/directive-name.component';
import { PipeNameComponent } from './pipes/pipe-name/pipe-name.component';



@NgModule({
  declarations: [
    SchemaPanelComponent,
    DirectiveNameComponent,
    PipeNameComponent
  ],
  imports: [
    CommonModule
  ]
})
export class SharedModule { }
