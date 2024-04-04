import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TextCurationComponent } from './components/text-curation.component';
import { TextCurationRoutingModule } from './text-curation-routing.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    TextCurationComponent,
    TextCurationRoutingModule
  ],
  exports: [
    TextCurationComponent
  ]
})
export class TextCurationModule { }
