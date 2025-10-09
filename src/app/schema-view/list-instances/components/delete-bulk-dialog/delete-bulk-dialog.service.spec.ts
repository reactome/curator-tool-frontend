import { TestBed } from '@angular/core/testing';

import {DeleteBulkDialogComponent} from "./delete-bulk-dialog.component";

describe('DeleteBulkDialogComponent', () => {
  let service: DeleteBulkDialogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeleteBulkDialogComponent);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
