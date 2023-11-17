import { TestBed } from '@angular/core/testing';

import { ViewOnlyService } from './view-only.service';

describe('ViewOnlyService', () => {
  let service: ViewOnlyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ViewOnlyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
