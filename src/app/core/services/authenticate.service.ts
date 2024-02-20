import { Injectable } from '@angular/core';
import {BehaviorSubject} from "rxjs";
import {ActivatedRoute} from "@angular/router";

@Injectable({
  providedIn: 'root'
})
export class AuthenticateService {
  public static readonly KEY = 'authenticated';

  private _enabled: boolean = false;
  private _emitter = new BehaviorSubject(this._enabled);
  public enabled$ = this._emitter.asObservable();

  constructor(private route: ActivatedRoute) {

    let local = sessionStorage.getItem(AuthenticateService.KEY);
    // if (local) this._enabled = JSON.parse(local);
    // route.queryParams.subscribe(params =>
    //   this.enabled = params[AuthenticateService.KEY] ?
    //     params[AuthenticateService.KEY] === 'true' :
    //     this._enabled
    // )
  }


  get enabled(): boolean {
    return this._enabled;
  }

   setEnabled(value: boolean) {
    this._enabled = value;
    console.log(value)
    sessionStorage.setItem(AuthenticateService.KEY, JSON.stringify(value));
    this._emitter.next(value);
  }

  login(data: {email: string; password: string}) {

  }
}
