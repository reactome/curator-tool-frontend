import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticateService } from 'src/app/core/services/authenticate.service';
import { DataService } from 'src/app/core/services/data.service';
import { User } from 'src/app/core/models/user';
import { catchError, of } from 'rxjs';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { UserInstancesService } from './user-instances.service';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent{
  
  // To show information
  readonly dialog = inject(MatDialog);

  constructor(private authService: AuthenticateService, 
              private userInstancesService: UserInstancesService,
              private dataService: DataService,
              private router: Router) {
  }

  submit(data: User) {
    this.authService.login(data).pipe(
      catchError(error => {
        this.handleError(error); // Custom error handling
        return of(null); // Return an observable to complete the stream
      })
    ).subscribe(token => {
      if (token) {
        localStorage.setItem('token', token);
        
        // Initialize schema classes if they haven't been loaded yet
        if (!this.dataService.isSchemaClassesLoaded()) {
          console.debug('Schema classes not loaded, initializing DataService after login...');
          this.dataService.initialize().then(() => {
            console.debug('DataService initialized successfully after login');
            this.userInstancesService.loadUserInstances();
            this.router.navigate(['/home']);
          }).catch(error => {
            console.warn('Failed to initialize DataService after login:', error);
            // Continue anyway - schema classes will be loaded on-demand
            this.userInstancesService.loadUserInstances();
            this.router.navigate(['/home']);
          });
        } else {
          // Schema classes already loaded, proceed normally
          this.userInstancesService.loadUserInstances();
          this.router.navigate(['/home']);
        }
      }
    });
  }

  private handleError(error: any): void {
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
