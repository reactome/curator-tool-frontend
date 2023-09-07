import { NgModule, Optional, SkipSelf } from '@angular/core';

@NgModule({})
export class CoreModule { 
  constructor(@Optional()
  @SkipSelf()
  core:CoreModule ) {
    if (core) {
      throw new Error("Core module should only be imported to the Root Module")
    }
  }
}
