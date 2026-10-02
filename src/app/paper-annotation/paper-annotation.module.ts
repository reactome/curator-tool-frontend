import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { EvidenceListComponent } from './components/evidence-list/evidence-list.component';
import { LoadStagingDialogComponent } from './components/load-staging-dialog/load-staging-dialog.component';
import { IssuesPanelComponent } from './components/issues-panel/issues-panel.component';
import { PaperAnnotationRoutingModule } from './paper-annotation-routing.module';
import { ProposalCardComponent } from './components/proposal-card/proposal-card.component';
import { ReactionDetailComponent } from './components/reaction-detail/reaction-detail.component';
import { SessionListComponent } from './components/session-list/session-list.component';
import { UsagePanelComponent } from './components/usage-panel/usage-panel.component';
import { WorkspaceComponent } from './components/workspace/workspace.component';

@NgModule({
  declarations: [
    SessionListComponent, WorkspaceComponent, ReactionDetailComponent, IssuesPanelComponent,
    ChatPanelComponent, ProposalCardComponent, LoadStagingDialogComponent, UsagePanelComponent
  ],
  imports: [
    CommonModule, FormsModule, PaperAnnotationRoutingModule, EvidenceListComponent,
    MatButtonModule, MatCardModule, MatChipsModule, MatDialogModule, MatDividerModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatProgressSpinnerModule, MatSelectModule,
    MatSnackBarModule, MatTabsModule, MatTooltipModule
  ]
})
export class PaperAnnotationModule { }
