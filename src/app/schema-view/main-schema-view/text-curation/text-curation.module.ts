import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TextCurationComponent } from './components/text-curation.component';
import { TextCurationRoutingModule } from './text-curation-routing.module';
import { MaterialModule } from 'src/app/shared/material/material.module';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    TextCurationComponent,
    TextCurationRoutingModule,
    MaterialModule,
    SharedModule
  ],
  exports: [
    TextCurationComponent
  ]
})
export class TextCurationModule { }
