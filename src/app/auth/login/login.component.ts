import { Input, Component, Output, EventEmitter } from '@angular/core';
import {FormGroup, FormControl, ReactiveFormsModule} from '@angular/forms';
import {AuthenticateService} from "../../core/services/authenticate.service";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})

export class LoginComponent {

  form: FormGroup = new FormGroup({
    username: new FormControl('username'),
    password: new FormControl('password'),
  });
  @Input() error: string = '';
  control = new FormControl();
  username= new FormControl('username');
  password = new FormControl('password');

  constructor(private authenticateService: AuthenticateService) {
  }

  submit() {
    if (this.form.valid) {
      this.authenticateService.setEnabled(true);
    }
  }
}
