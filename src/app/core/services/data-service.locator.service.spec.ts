import { TestBed } from '@angular/core/testing';

import { DataServiceLocatorService } from './data-service.locator.service';

describe('DataServiceLocatorService', () => {
  let service: DataServiceLocatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataServiceLocatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
