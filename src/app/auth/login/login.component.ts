import { Input, Component, Output, EventEmitter } from '@angular/core';
import {FormGroup, FormControl, ReactiveFormsModule} from '@angular/forms';
import {MatCardModule} from "@angular/material/card";
import {MatInputModule} from "@angular/material/input";
import {MatButtonModule} from "@angular/material/button";
import {AuthenticateService} from "../../core/services/authenticate.service";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule
  ]
})

export class LoginComponent {

  form: FormGroup = new FormGroup({
    username: new FormControl('username'),
    password: new FormControl('password'),
  });
  @Input() error: string = '';

  constructor(private authenticateService: AuthenticateService) {
  }

  submit() {
    if (this.form.valid) {
      this.authenticateService.setEnabled(true);
    }
  }
}
