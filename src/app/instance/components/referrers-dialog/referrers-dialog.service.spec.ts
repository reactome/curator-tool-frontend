import { TestBed } from '@angular/core/testing';

import {ReferrersDialogService } from './referrers-dialog.service';
import {ReferrersDialogComponent} from "./referrers-dialog.component";

describe('ReferrersDialogComponent', () => {
  let service: ReferrersDialogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReferrersDialogComponent);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
