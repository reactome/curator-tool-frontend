import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthenticateService } from 'src/app/core/services/authenticate.service';
import { DataService } from 'src/app/core/services/data.service';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import { commonTestProviders, componentTestImports, createMatDialogSpy } from 'src/testing';
import { LoginComponent } from './login.component';
import { UserInstancesService } from './user-instances.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authService: jasmine.SpyObj<AuthenticateService>;
  let dataService: jasmine.SpyObj<DataService>;
  let userInstances: jasmine.SpyObj<UserInstancesService>;
  let router: any;
  let dialog: any;
  let pageTitle: jasmine.SpyObj<PageTitleService>;

  const credentials = { username: 'curator', password: 'secret' };

  function build() {
    dialog = createMatDialogSpy();
    userInstances = jasmine.createSpyObj<UserInstancesService>(
      'UserInstancesService', ['loadUserInstances']);
    pageTitle = jasmine.createSpyObj<PageTitleService>('PageTitleService', ['setTitle']);

    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [LoginComponent],
      providers: [
        ...commonTestProviders(),
        LoginComponent,
        { provide: MatDialog, useValue: dialog },
        { provide: UserInstancesService, useValue: userInstances },
        { provide: PageTitleService, useValue: pageTitle }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    component = TestBed.inject(LoginComponent);
    authService = TestBed.inject(AuthenticateService) as jasmine.SpyObj<AuthenticateService>;
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    router = TestBed.inject(Router);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    build();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('sets the page title to Sign In', () => {
    expect(pageTitle.setTitle).toHaveBeenCalledWith('Sign In');
  });

  it('stores the token and the username on a successful login', () => {
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);

    expect(localStorage.getItem('token')).toEqual('a-token');
    expect(localStorage.getItem('login_username')).toEqual('curator');
  });

  it('loads the staged edits and navigates home when nothing was remembered', () => {
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);

    expect(userInstances.loadUserInstances).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('returns the tab to the view it was on before the session ended', () => {
    // A deep link blocked by authGuard is remembered in sessionStorage; login has to honour it
    // rather than always dropping the curator on /home.
    sessionStorage.setItem('currentUrl', '/schema_view/instance/100');
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/schema_view/instance/100');
  });

  it('consumes the remembered view so a later login does not reuse it', () => {
    sessionStorage.setItem('currentUrl', '/schema_view/instance/100');
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);
    router.navigateByUrl.calls.reset();
    component.submit(credentials);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('initializes the schema before finishing login when it is not loaded yet', fakeAsync(() => {
    dataService.isSchemaClassesLoaded.and.returnValue(false);
    dataService.initialize.and.returnValue(Promise.resolve());
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);
    // finishLogin is behind the initialize() promise, so nothing has navigated yet.
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    tick();

    expect(dataService.initialize).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  }));

  it('still finishes login when schema initialization fails', fakeAsync(() => {
    // Schema classes load on demand later, so a failure here must not strand the curator.
    dataService.isSchemaClassesLoaded.and.returnValue(false);
    dataService.initialize.and.returnValue(Promise.reject(new Error('backend down')));
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);
    tick();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  }));

  it('skips initialization when the schema is already loaded', () => {
    dataService.isSchemaClassesLoaded.and.returnValue(true);
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);

    expect(dataService.initialize).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('shows an error dialog and does not navigate when login fails', () => {
    authService.login.and.returnValue(throwError(() => new Error('401')));

    component.submit(credentials);

    expect(dialog.open).toHaveBeenCalled();
    expect(dialog.open.calls.mostRecent().args[0]).toBe(InfoDialogComponent);
    expect(dialog.open.calls.mostRecent().args[1].data.message)
      .toEqual('Wrong user name or password');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('reports a failed login exactly once', () => {
    // catchError used to return of(null), which emitted a falsy token into the subscriber
    // below and fell into the "no usable token" branch -- reporting the same failure again
    // and stacking two identical error dialogs for the curator to dismiss in turn.
    authService.login.and.returnValue(throwError(() => new Error('401')));

    component.submit(credentials);

    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error when the request succeeds but carries no token', () => {
    // This used to fail silently, leaving the curator on the login page with no feedback.
    authService.login.and.returnValue(of(undefined as any));

    component.submit(credentials);

    expect(dialog.open).toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('re-enables the form after a failure so the curator can retry', () => {
    authService.login.and.returnValue(throwError(() => new Error('401')));

    component.submit(credentials);

    expect(component.submitting).toBeFalse();
  });

  it('ignores repeat submits while a login is still in flight', fakeAsync(() => {
    // Each extra click used to fire another concurrent login + bootstrap sequence.
    dataService.isSchemaClassesLoaded.and.returnValue(false);
    let resolveInit: () => void = () => { };
    dataService.initialize.and.returnValue(new Promise<void>(res => (resolveInit = res)));
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);
    component.submit(credentials);
    component.submit(credentials);

    expect(authService.login).toHaveBeenCalledTimes(1);
    resolveInit();
    tick();
  }));

  it('clears the in-flight flag once login completes', () => {
    authService.login.and.returnValue(of('a-token'));

    component.submit(credentials);

    expect(component.submitting).toBeFalse();
  });
});
