import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {MaterialModule} from "../shared/material/material.module";
import {HomePageComponent} from "./components/home-page/home-page.component";
import {HomeRoutingModule} from "./home-routing.module";
import { StatusModule } from '../status/status.module';



@NgModule({
  declarations: [HomePageComponent],
  exports: [
    HomePageComponent
  ],
    imports: [
        CommonModule,
        MaterialModule,
        HomeRoutingModule,
        StatusModule
    ]
})
export class HomeModule {}
