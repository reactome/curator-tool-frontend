import { Location } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * An existing Reactome instance: its displayName and dbId, linking to its page in the schema view (a new tab, so the
 * annotation stays open). Location adds the application's base path (e.g. /curatortool/ in production).
 */
@Component({
  selector: 'app-db-instance-link',
  template: `<a class="db-link" [href]="href" target="_blank" rel="noopener"
                [matTooltip]="'Open in the schema view (new tab): ' + (name || 'dbId ' + dbId)"
                matTooltipShowDelay="500"><span class="name" *ngIf="name">{{ name }}</span><span class="dbid">{{ dbId }}</span><mat-icon inline>open_in_new</mat-icon></a>`,
  styles: [`.db-link { display: inline-flex; align-items: baseline; gap: 4px; color: #1565c0; text-decoration: none; }
            .db-link:hover .name { text-decoration: underline; }
            .dbid { font-size: 11px; color: #555; background: #eef3fa; border-radius: 8px; padding: 0 6px; }
            mat-icon { font-size: 13px; align-self: center; }`]
})
export class DbInstanceLinkComponent {
  @Input({ required: true }) dbId!: number;
  @Input() name: string | null | undefined = null;

  constructor(private location: Location) {}

  get href(): string {
    return this.location.prepareExternalUrl(`/schema_view/instance/${this.dbId}`);
  }
}
