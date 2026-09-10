import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { AttributeValue } from 'src/app/core/models/reactome-instance.model';
import {
  createMatDialogSpy,
  expectDialogService,
  makeInstance,
  makeInstanceAttribute
} from 'src/testing';
import { NewInstanceDialogComponent } from './new-instance-dialog.component';
import { NewInstanceDialogService } from './new-instance-dialog.service';

describe('NewInstanceDialogService', () => {
  let service: NewInstanceDialogService;
  let dialog: ReturnType<typeof createMatDialogSpy>;

  beforeEach(() => {
    dialog = createMatDialogSpy();
    TestBed.configureTestingModule({
      providers: [NewInstanceDialogService, { provide: MatDialog, useValue: dialog }]
    });
    service = TestBed.inject(NewInstanceDialogService);
  });

  it('opens the new-instance dialog with the slot being filled as its data', () => {
    // The dialog needs the attribute to know which classes the new instance may belong to,
    // so passing the whole AttributeValue through (not just the instance) is the contract.
    const attributeValue: AttributeValue = {
      attribute: makeInstanceAttribute('hasEvent', ['Event']),
      value: undefined,
      index: 0
    };

    const ref = service.openDialog(attributeValue);

    expectDialogService(dialog, ref, NewInstanceDialogComponent, attributeValue);
  });

  it('gives the dialog a fixed size so the class tree and the form both fit', () => {
    service.openDialog({
      attribute: makeInstanceAttribute('input', ['PhysicalEntity']),
      value: makeInstance()
    });

    const config = dialog.open.calls.mostRecent().args[1];
    expect(config.width).toEqual('1000px');
    expect(config.height).toEqual('500px');
  });
});
