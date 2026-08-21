import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticateService } from 'src/app/core/services/authenticate.service';
import { DataService } from 'src/app/core/services/data.service';
import { User } from 'src/app/core/models/user';
import { catchError, of } from 'rxjs';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { UserInstancesService } from './user-instances.service';
import { takeReturnUrl } from 'src/app/core/services/session-url';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent{
  
  // To show information
  readonly dialog = inject(MatDialog);

  // Tracks whether a login request is currently in flight so the OK button can be
  // disabled and repeated submits ignored (previously each click fired another
  // concurrent login + bootstrap sequence).
  submitting = false;

  constructor(private authService: AuthenticateService, 
              private userInstancesService: UserInstancesService,
              private dataService: DataService,
              private router: Router) {
  }

  submit(data: User) {
    // Ignore repeat submits while a request is already in flight.
    if (this.submitting)
      return;
    this.submitting = true;

    this.authService.login(data).pipe(
      catchError(error => {
        this.handleError(error); // Custom error handling
        return of(null); // Return an observable to complete the stream
      })
    ).subscribe(token => {
      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('login_username', data.username);
        // Where this tab was before its session ended, if anything remembered it.
        const url: string = takeReturnUrl();

        // Initialize schema classes if they haven't been loaded yet
        if (!this.dataService.isSchemaClassesLoaded()) {
          console.debug('Schema classes not loaded, initializing DataService after login...');
          this.dataService.initialize().then(() => {
            console.debug('DataService initialized successfully after login');
            this.finishLogin(url);
          }).catch(error => {
            console.warn('Failed to initialize DataService after login:', error);
            // Continue anyway - schema classes will be loaded on-demand
            this.finishLogin(url);
          });
        } else {
          // Schema classes already loaded, proceed normally
          this.finishLogin(url);
        }
      } else {
        // The request completed without an error but returned no usable token.
        // Previously this silently did nothing, leaving the user on the login page
        // with no feedback. Surface it and re-enable the form so they can retry.
        this.submitting = false;
        this.handleError(new Error('Login response did not contain a token'));
      }
    });
  }

  private finishLogin(url: string): void {
    this.userInstancesService.loadUserInstances();
    this.router.navigateByUrl(url);
    this.submitting = false;
  }

  private handleError(error: any): void {
    this.submitting = false;
    this.dialog.open(InfoDialogComponent, {
      data: {
        title: 'Error',
        message: 'Wrong user name or password',
        instanceInfo: ''
      }
    });
    console.error('Login failed:', error); // Log the error to the console
  }

}
