import {Component, OnInit} from '@angular/core';
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {combineLatest} from "rxjs";
import {MaterialModule} from "../../../material/material.module";
import {ReactiveFormsModule} from "@angular/forms";

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit{

  searchForName(event: Event) {
  }

  recordSearchKey(event: Event) {
  }

  ngOnInit(): void {
    console.log("home")
  }

}
