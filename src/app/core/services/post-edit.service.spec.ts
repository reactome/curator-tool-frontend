import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';

import { ChEBIAutoFiller } from '../post-edit/ChEBIAutoFiller';
import { ExternalOntologyFiller } from '../post-edit/ExternalOntologyFiller';
import { InstanceNameGenerator } from '../post-edit/InstanceNameGenerator';
import { LiteratureReferenceFiller } from '../post-edit/LiteratureReferenceFiller';
import { ReferenceSequenceAutoFiller } from '../post-edit/ReferenceSequenceAutoFiller';
import { ReviewStatusCheck } from '../post-edit/ReviewStatusCheck';
import { createMatDialogSpy, makeInstance, provideStoreSpy } from 'src/testing';
import { commonTestProviders } from 'src/testing';
import { PostEditService } from './post-edit.service';

describe('PostEditService', () => {
  let service: PostEditService;
  /** Names of the operations invoked by the last `postEdit` call, in order. */
  let calls: string[];

  /** Every operation the service is expected to register, in the order it registers them. */
  const OPERATIONS: [string, { prototype: { postEdit: any } }][] = [
    ['LiteratureReferenceFiller', LiteratureReferenceFiller],
    ['ExternalOntologyFiller', ExternalOntologyFiller],
    ['ReferenceSequenceAutoFiller', ReferenceSequenceAutoFiller],
    ['ChEBIAutoFiller', ChEBIAutoFiller],
    ['InstanceNameGenerator', InstanceNameGenerator],
    ['ReviewStatusCheck', ReviewStatusCheck]
  ];

  beforeEach(() => {
    calls = [];
    // Spy on the prototypes rather than the instances: the service builds its own operations
    // in the constructor, so there is no seam to inject doubles through.
    for (const [name, ctor] of OPERATIONS) {
      spyOn(ctor.prototype, 'postEdit').and.callFake(() => {
        calls.push(name);
        return true;
      });
    }

    TestBed.configureTestingModule({
      providers: [
        ...commonTestProviders(),
        PostEditService,
        provideStoreSpy(),
        { provide: MatDialog, useValue: createMatDialogSpy() }
      ]
    });
    service = TestBed.inject(PostEditService);
  });

  it('is created with every post-edit operation registered', () => {
    expect(service).toBeTruthy();
    expect((service as any).postEditOperations.length).toEqual(OPERATIONS.length);
  });

  it('runs every registered operation for one edit', () => {
    service.postEdit(makeInstance(), 'name', undefined);

    expect(calls.length).toEqual(OPERATIONS.length);
  });

  it('runs the operations in registration order', () => {
    service.postEdit(makeInstance(), 'name', undefined);

    expect(calls).toEqual(OPERATIONS.map(([name]) => name));
  });

  it('generates the display name only after the auto-fillers have run', () => {
    // The service's own comment requires this: the name is derived from slots the fillers
    // populate, so generating it first would name the instance off incomplete data.
    service.postEdit(makeInstance(), 'referenceEntity', undefined);

    const nameIndex = calls.indexOf('InstanceNameGenerator');
    for (const filler of ['LiteratureReferenceFiller', 'ExternalOntologyFiller',
      'ReferenceSequenceAutoFiller', 'ChEBIAutoFiller']) {
      expect(calls.indexOf(filler)).toBeLessThan(nameIndex);
    }
  });

  it('passes the edited instance and attribute name to each operation', () => {
    const instance = makeInstance({ dbId: 100 });

    service.postEdit(instance, 'input', undefined);

    for (const [, ctor] of OPERATIONS) {
      expect(ctor.prototype.postEdit).toHaveBeenCalledWith(instance, 'input', undefined);
    }
  });

  it('forwards the listener so the caller can refresh the view when done', () => {
    // Only the async operations declare the listener parameter -- InstanceNameGenerator and
    // ReviewStatusCheck finish synchronously and ignore it -- but the service passes it to
    // all of them uniformly, which is what this checks.
    const listener = { donePostEdit: jasmine.createSpy('donePostEdit').and.returnValue(true) };

    service.postEdit(makeInstance(), 'name', listener);

    expect(LiteratureReferenceFiller.prototype.postEdit)
      .toHaveBeenCalledWith(jasmine.anything() as any, 'name', listener);
  });

  it('accepts an undefined attribute name, as multi-attribute edits pass', () => {
    service.postEdit(makeInstance(), undefined, undefined);

    expect(calls.length).toEqual(OPERATIONS.length);
  });

  it('keeps running the remaining operations when one reports no change', () => {
    (LiteratureReferenceFiller.prototype.postEdit as jasmine.Spy).and.returnValue(false);

    service.postEdit(makeInstance(), 'name', undefined);

    expect(calls).toContain('InstanceNameGenerator');
  });
});
