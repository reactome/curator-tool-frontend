import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataSubjectService {
  private dbId = new Subject<string>();
  public dbId$ = this.dbId.asObservable();
  private plotParam = new Subject<string>();
  public plotParam$ = this.plotParam.asObservable();
  private eventTreeParam = new Subject<string>();
  public eventTreeParam$ = this.eventTreeParam.asObservable();

  setDbId(dbId: string) {
    this.dbId.next(dbId);
  }

  setPlotParam(plotParam: string) {
    this.plotParam.next(plotParam);
  }

  setEventTreeParam(eventTreeParam: string) {
    this.eventTreeParam.next(eventTreeParam);
  }
}
