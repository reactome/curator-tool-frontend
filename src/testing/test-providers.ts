/**
 * Composable provider bundles for `TestBed.configureTestingModule`.
 *
 * The whole point of this file is that the handful of things that break a component spec in
 * this app are always the same handful: no `Store`, no `HttpClient`, no `ActivatedRoute`, no
 * `ChangeDetectorRef`, and -- for dialogs -- no `MAT_DIALOG_DATA`/`MatDialogRef`.
 * `commonTestProviders()` supplies all but the dialog pair, so a spec's `providers` array can
 * be about the component under test instead of about Angular plumbing.
 *
 * Typical use:
 *
 *   TestBed.configureTestingModule({
 *     imports: [...componentTestImports()],
 *     declarations: [MyComponent],
 *     providers: [...commonTestProviders(), { provide: Thing, useValue: myThing }],
 *     schemas: [NO_ERRORS_SCHEMA],
 *   });
 *
 * Later entries win in Angular DI, so a spec's own provider always overrides a default here.
 */

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ChangeDetectorRef, Provider } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { AttributeEditService } from '../app/core/services/attribute-edit.service';
import { AuthenticateService } from '../app/core/services/authenticate.service';
import { DataService } from '../app/core/services/data.service';
import { InstanceUtilities } from '../app/core/services/instance.service';
import { PostEditService } from '../app/core/services/post-edit.service';
import { provideStoreSpy } from './mock-store';
import {
  createAttributeEditServiceSpy,
  createAuthServiceSpy,
  createDataServiceSpy,
  createInstanceUtilitiesSpy,
  createMatDialogSpy,
  createPostEditServiceSpy
} from './test-doubles';

/** Shape of an `ActivatedRoute` double: route params, query params, and static data. */
export interface RouteStubOptions {
  params?: Record<string, any>;
  queryParams?: Record<string, any>;
  data?: Record<string, any>;
  fragment?: string;
  /**
   * Path segments of the ancestor routes, outermost first, as several components read them
   * off `route.pathFromRoot` to work out which view they are rendering inside. Defaults to
   * `['schema_view']`.
   */
  pathFromRoot?: string[];
}

/**
 * An `ActivatedRoute` double. Both the observable (`params`) and snapshot
 * (`snapshot.paramMap`) forms are populated, because components in this app read whichever
 * was convenient at the time.
 */
export function createRouteStub(options: RouteStubOptions = {}) {
  const params = options.params ?? {};
  const queryParams = options.queryParams ?? {};
  const data = options.data ?? {};
  return {
    params: of(params),
    queryParams: of(queryParams),
    data: of(data),
    fragment: of(options.fragment ?? null),
    paramMap: of(convertToParamMap(params)),
    queryParamMap: of(convertToParamMap(queryParams)),
    snapshot: {
      params,
      queryParams,
      data,
      fragment: options.fragment ?? null,
      paramMap: convertToParamMap(params),
      queryParamMap: convertToParamMap(queryParams)
    },
    parent: null,
    outlet: 'primary',
    routeConfig: null,
    // Shaped as the router builds it: one entry per ancestor route, each with a snapshot
    // holding that route's own UrlSegments. Components reduce over it to recover the view
    // they are inside, so the nesting has to be right, not just the strings.
    pathFromRoot: (options.pathFromRoot ?? ['schema_view'])
      .map(segment => ({ snapshot: { url: [{ path: segment }] } }))
  };
}

/** Provider for an `ActivatedRoute` double. */
export function provideRouteStub(options: RouteStubOptions = {}): Provider {
  return { provide: ActivatedRoute, useValue: createRouteStub(options) };
}

/**
 * A `Router` double that records navigation instead of performing it. Real routing needs the
 * whole route config, which is more than a component spec should have to set up.
 */
export function createRouterStub(url = '/') {
  const navigate = jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true));
  const navigateByUrl = jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true));
  return {
    url,
    navigate,
    navigateByUrl,
    createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue({}),
    parseUrl: jasmine.createSpy('parseUrl').and.returnValue({}),
    serializeUrl: jasmine.createSpy('serializeUrl').and.returnValue(url),
    events: of(),
    routerState: { root: {}, snapshot: { root: {} } }
  };
}

/** Provider for a recording `Router` double. */
export function provideRouterStub(url = '/'): Provider {
  return { provide: Router, useValue: createRouterStub(url) };
}

/**
 * Providers a `MatDialog`-hosted component needs to be constructed outside an overlay:
 * its injected `MAT_DIALOG_DATA` and a `MatDialogRef` double.
 *
 * This is the fix for `No provider for InjectionToken MatMdcDialogData`, which accounted for
 * eight of the failures in the suite before this harness existed.
 */
export function provideDialogContext(data: unknown = {}, closeResult?: unknown): Provider[] {
  return [
    { provide: MAT_DIALOG_DATA, useValue: data },
    {
      provide: MatDialogRef,
      useValue: {
        close: jasmine.createSpy('close'),
        afterClosed: () => of(closeResult),
        afterOpened: () => of(undefined),
        backdropClick: () => of(),
        keydownEvents: () => of(),
        updateSize: jasmine.createSpy('updateSize'),
        updatePosition: jasmine.createSpy('updatePosition'),
        disableClose: false
      }
    }
  ];
}

/**
 * A `ChangeDetectorRef` double.
 *
 * Angular only offers the real one inside a component instantiation, so a spec that builds its
 * component through `providers` + `TestBed.inject(MyComponent)` -- the way to test a container
 * without rendering its whole template -- fails with "No provider for ChangeDetectorRef" the
 * moment the component injects one. Marking dirty and detecting changes are no-ops when there
 * is no view to update.
 */
export function provideChangeDetectorRefStub(): Provider {
  return {
    provide: ChangeDetectorRef,
    useValue: jasmine.createSpyObj('ChangeDetectorRef',
      ['detectChanges', 'markForCheck', 'detach', 'reattach', 'checkNoChanges'])
  };
}

/** A `MatSnackBar` double. Components call `open` on it in error paths. */
export function provideSnackBarStub(): Provider {
  return {
    provide: MatSnackBar,
    useValue: jasmine.createSpyObj('MatSnackBar', ['open', 'openFromComponent', 'dismiss'])
  };
}

/**
 * The providers that unblock essentially every component in this app, plus the app's own core
 * services as spies. Spread it first in `providers` so a spec can override any entry.
 *
 * Deliberately *not* included: `MAT_DIALOG_DATA`/`MatDialogRef`, since supplying them to a
 * non-dialog component would mask a real wiring mistake. Add `provideDialogContext()` for
 * dialog components.
 */
export function commonTestProviders(): Provider[] {
  return [
    provideStoreSpy(),
    provideRouteStub(),
    provideRouterStub(),
    provideSnackBarStub(),
    provideChangeDetectorRefStub(),
    { provide: DataService, useValue: createDataServiceSpy() },
    { provide: InstanceUtilities, useValue: createInstanceUtilitiesSpy() },
    { provide: AuthenticateService, useValue: createAuthServiceSpy() },
    { provide: AttributeEditService, useValue: createAttributeEditServiceSpy() },
    { provide: PostEditService, useValue: createPostEditServiceSpy() },
    { provide: MatDialog, useValue: createMatDialogSpy() }
  ];
}

/**
 * Imports for a component spec: `HttpClientTestingModule` (so any service that slipped
 * through as a real instance still constructs), `NoopAnimationsModule` (Material components
 * throw without an animations provider), and `RouterTestingModule`.
 */
export function componentTestImports(): any[] {
  return [HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule];
}

/**
 * Convenience for a service spec: HTTP testing plus a recording store, with no Material or
 * routing weight.
 */
export function serviceTestSetup() {
  return {
    imports: [HttpClientTestingModule],
    providers: [provideStoreSpy(), provideRouterStub()]
  };
}
