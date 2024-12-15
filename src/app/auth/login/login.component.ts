import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthenticateService } from 'src/app/core/services/authenticate.service';
import { User } from 'src/app/core/models/user';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent{
  
  constructor(private store: Store, private authService: AuthenticateService, private router: Router, private _snackBar: MatSnackBar) {
    this.checkJWT();
  }

  submit(data: User) {
    this.authService.login(data).subscribe(token => {
      localStorage.setItem('token', token);
      this.router.navigate(['/home']);
    });
  }

  checkJWT() {
    if(this.authService.isAuthenticated()) {
      this.router.navigate(['/home'])
    }
  }

}
