import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {MaterialModule} from "../shared/material/material.module";
import {HomePageComponent} from "./components/home-page/home-page.component";
import {HomeRoutingModule} from "./home-routing.module";
import {StatusComponent} from "../status/status.component";



@NgModule({
  declarations: [HomePageComponent],
  exports: [
    HomePageComponent
  ],
    imports: [
        CommonModule,
        MaterialModule,
        HomeRoutingModule,
        StatusComponent
    ]
})
export class HomeModule {}
