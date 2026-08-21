import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule, Routes } from '@angular/router';
import { ReferrersPageComponent } from './referrers-page.component';

/**
 * Mounted at schema_view/referrers, so the page has a URL of its own rather than one nested
 * under the instance it describes. It is a lazy module of its own rather than part of
 * InstanceModule: mounting it at the schema-view level would otherwise pull all of
 * InstanceModule in eagerly, and that is the bulk of the tool.
 */
const routes: Routes = [
  {
    path: ':dbId',
    component: ReferrersPageComponent,
  },
];

@NgModule({
  declarations: [
    ReferrersPageComponent,
  ],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    RouterModule.forChild(routes),
  ],
})
export class ReferrersPageModule {
}
