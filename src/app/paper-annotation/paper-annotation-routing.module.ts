import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SessionListComponent } from './components/session-list/session-list.component';
import { WorkspaceComponent } from './components/workspace/workspace.component';

const routes: Routes = [
  { path: '', component: SessionListComponent },
  { path: ':id', component: WorkspaceComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PaperAnnotationRoutingModule { }
