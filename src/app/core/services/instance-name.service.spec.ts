import { TestBed } from '@angular/core/testing';

import { InstanceNameService } from './instance-name.service';

describe('InstanceNameService', () => {
  let service: InstanceNameService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InstanceNameService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
