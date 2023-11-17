import {EventEmitter, Injectable} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {BehaviorSubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ViewOnlyService {
  public static readonly KEY = 'view-only';

  private _enabled: boolean = false;
  private _emitter = new BehaviorSubject(this._enabled);
  public enabled$ = this._emitter.asObservable();

  constructor(private route: ActivatedRoute) {

    let local = sessionStorage.getItem(ViewOnlyService.KEY);
    if (local) this._enabled = JSON.parse(local);
    route.queryParams.subscribe(params =>
      this.enabled = params[ViewOnlyService.KEY] ?
        params[ViewOnlyService.KEY] === 'true' :
        this._enabled
    )
  }


  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    sessionStorage.setItem(ViewOnlyService.KEY, JSON.stringify(value));
    this._emitter.next(value);
  }
}
