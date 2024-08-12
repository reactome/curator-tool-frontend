import { TestBed } from '@angular/core/testing';

import {DeletionDialogService } from './deletion-dialog.service';
import {DeletionDialogComponent} from "./deletion-dialog.component";

describe('ReferrersDialogComponent', () => {
  let service: DeletionDialogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeletionDialogComponent);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
