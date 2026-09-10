import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { InactivityService } from './core/services/inactivity.service';
import { SessionSyncService } from './core/services/session-sync.service';
import { UserInstancesService } from './auth/login/user-instances.service';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let component: AppComponent;
  let inactivity: jasmine.SpyObj<InactivityService>;
  let sessionSync: jasmine.SpyObj<SessionSyncService>;
  let userInstances: jasmine.SpyObj<UserInstancesService>;

  beforeEach(async () => {
    inactivity = jasmine.createSpyObj<InactivityService>('InactivityService', ['start']);
    sessionSync = jasmine.createSpyObj<SessionSyncService>('SessionSyncService', ['start']);
    userInstances = jasmine.createSpyObj<UserInstancesService>(
      'UserInstancesService', ['loadUserInstances']);
    inactivity.start.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [AppComponent],
      providers: [
        { provide: InactivityService, useValue: inactivity },
        { provide: SessionSyncService, useValue: sessionSync },
        { provide: UserInstancesService, useValue: userInstances }
      ],
      // The shell template pulls in the router outlet plus the tour and help panels.
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    component = TestBed.createComponent(AppComponent).componentInstance;
  });

  it('creates the app shell', () => {
    expect(component).toBeTruthy();
  });

  it('starts the inactivity watchdog before anything else on init', () => {
    component.ngOnInit();

    expect(inactivity.start).toHaveBeenCalled();
  });

  it('starts cross-tab session sync so a logout elsewhere tears this tab down too', () => {
    component.ngOnInit();

    expect(sessionSync.start).toHaveBeenCalled();
  });

  it('loads the staged edits when the session is still fresh', () => {
    inactivity.start.and.returnValue(false);

    component.ngOnInit();

    expect(userInstances.loadUserInstances).toHaveBeenCalled();
  });

  it('does not load staged edits when the session was already idle past the timeout', () => {
    // The watchdog is mid-logout, so the token is about to be invalidated: firing an
    // authenticated request here would just 401.
    inactivity.start.and.returnValue(true);

    component.ngOnInit();

    expect(userInstances.loadUserInstances).not.toHaveBeenCalled();
  });

  it('still starts session sync when the session was stale', () => {
    inactivity.start.and.returnValue(true);

    component.ngOnInit();

    expect(sessionSync.start).toHaveBeenCalled();
  });
});
