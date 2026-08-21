import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, switchMap, of, catchError } from 'rxjs';
import { Instance, Referrer } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';

/**
 * A routed, bookmarkable view of an instance's referrers, reached via
 * schema_view/referrers/:dbId. Unlike ReferrersDialogComponent (a modal that
 * disappears with the instance being edited), this has a stable URL that can be shared or
 * bookmarked, so it renders the referrers as a flat two-column table: the referring
 * attribute on the left and the referring instances on the right.
 */
@Component({
  selector: 'app-referrers-page',
  templateUrl: './referrers-page.component.html',
  styleUrls: ['./referrers-page.component.scss']
})
export class ReferrersPageComponent implements OnInit, OnDestroy {
  // The instance the referrers point at. Undefined until loaded, or if it cannot be loaded.
  instance: Instance | undefined;
  // Referrer groups, sorted by attribute name so the table order is stable across reloads
  // (the backend does not guarantee an order).
  referrerGroups: Referrer[] = [];
  totalCount: number = 0;
  showProgressSpinner: boolean = false;
  // Set when the dbId in the URL is unusable or the instance cannot be loaded. A stable URL
  // can be pasted in with a typo or point at an instance that has since been deleted, so the
  // page has to say so rather than render an empty table.
  errorMessage: string | undefined;

  private subscriptions: Subscription = new Subscription();

  constructor(private route: ActivatedRoute,
    private dataService: DataService) {
  }

  ngOnInit() {
    // Subscribe to params rather than reading a snapshot so that navigating from one
    // referrers URL to another (the router reuses this component) reloads the content.
    // switchMap so that a navigation arriving while a load is still running abandons that
    // load: fetching referrers is a heavy call, and a late response from the instance we
    // just navigated away from must not land on top of the one being shown.
    this.subscriptions.add(this.route.params.pipe(
      switchMap(params => {
        const dbId = parseInt(params['dbId']);
        this.reset();
        if (isNaN(dbId)) {
          this.errorMessage = `"${params['dbId']}" is not a valid instance id.`;
          return of([] as Referrer[]);
        }
        this.showProgressSpinner = true;
        return this.loadReferrers(dbId);
      })
    ).subscribe(referrers => {
      this.referrerGroups = referrers
        .filter(group => group.referrers.length > 0)
        .sort((a, b) => a.attributeName.localeCompare(b.attributeName));
      this.totalCount = this.referrerGroups.reduce((count, group) => count + group.referrers.length, 0);
      this.showProgressSpinner = false;
    }));
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /**
   * The router path used for the links in the table. Returning a routerLink array instead of
   * calling window.open keeps them real anchors, so the usual browser gestures
   * (middle-click, ctrl-click, copy link address) work on a page meant to be shared.
   */
  instanceLink(instance: Instance): any[] {
    return ['/schema_view', 'instance', instance.dbId];
  }

  /**
   * The "[Class:dbId] displayName" label used throughout the tool. Referrers arrive as shell
   * instances, so schemaClassName, dbId and displayName are all that can be shown here.
   */
  instanceLabel(instance: Instance): string {
    const name = instance.displayName ?? '';
    return `[${instance.schemaClassName}:${instance.dbId}] ${name}`.trim();
  }

  /**
   * Load the instance first: its display name identifies the page, and a failure here is what
   * tells us the id in the URL points at nothing. Errors are turned into a message rather
   * than rethrown, so one bad id does not end the params subscription and leave the page
   * unresponsive to any later navigation.
   */
  private loadReferrers(dbId: number) {
    return this.dataService.fetchInstance(dbId).pipe(
      switchMap(instance => {
        this.instance = instance;
        return this.dataService.getReferrers(dbId);
      }),
      catchError(() => {
        this.errorMessage = this.instance
          ? `Referrers of instance ${dbId} could not be loaded.`
          : `Instance ${dbId} could not be loaded.`;
        return of([] as Referrer[]);
      })
    );
  }

  private reset() {
    this.instance = undefined;
    this.referrerGroups = [];
    this.totalCount = 0;
    this.errorMessage = undefined;
    this.showProgressSpinner = false;
  }
}
