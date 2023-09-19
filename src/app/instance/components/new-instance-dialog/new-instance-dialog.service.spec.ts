import { TestBed } from '@angular/core/testing';

import { NewInstanceDialogService } from './new-instance-dialog.service';

describe('NewInstanceDialogService', () => {
  let service: NewInstanceDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NewInstanceDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
