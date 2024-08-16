import { TestBed } from '@angular/core/testing';

import {ReferrersDialogService } from './confirm-delete-dialog.service';
import {ConfirmDeleteDialogComponent} from "./confirm-delete-dialog.component";

describe('ConfirmDeleteDialogComponent', () => {
  let service: ConfirmDeleteDialogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmDeleteDialogComponent);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
