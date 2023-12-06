import { TestBed } from '@angular/core/testing';

import { CompareUpdatedInstanceDialogService } from './compare-updated-instance-dialog.service';

describe('NewInstanceDialogService', () => {
  let service: CompareUpdatedInstanceDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompareUpdatedInstanceDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
