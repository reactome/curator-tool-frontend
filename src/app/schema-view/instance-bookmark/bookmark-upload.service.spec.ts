import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of, throwError } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { BookmarkUploadService, MAX_UPLOADED_DB_IDS } from './bookmark-upload.service';
import { BookmarkActions } from './state/bookmark.actions';

describe('BookmarkUploadService', () => {
  let service: BookmarkUploadService;
  let dataService: jasmine.SpyObj<DataService>;
  let instUtils: jasmine.SpyObj<InstanceUtilities>;
  let store: jasmine.SpyObj<Store>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let bookmarks: Instance[];
  let removedNewDbIds: number[];

  function makeInstance(dbId: number): Instance {
    return { dbId, schemaClassName: 'Pathway', displayName: `inst-${dbId}` };
  }

  beforeEach(() => {
    bookmarks = [];
    removedNewDbIds = [];

    dataService = jasmine.createSpyObj<DataService>('DataService', ['fetchInstanceInBatch']);
    // The default stand-in for the server: every requested dbId exists.
    dataService.fetchInstanceInBatch.and.callFake((dbIds: number[]) => of(dbIds.map(makeInstance)));

    instUtils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities',
      ['makeShell', 'isPermanentlyRemovedNewInstance']);
    instUtils.makeShell.and.callFake((inst: Instance) => ({
      dbId: inst.dbId, schemaClassName: inst.schemaClassName, displayName: inst.displayName
    }));
    instUtils.isPermanentlyRemovedNewInstance.and.callFake((dbId: number) => removedNewDbIds.includes(dbId));

    store = jasmine.createSpyObj<Store>('Store', ['dispatch', 'select']);
    store.select.and.callFake(() => of(bookmarks) as any);

    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

    TestBed.configureTestingModule({
      providers: [
        BookmarkUploadService,
        { provide: DataService, useValue: dataService },
        { provide: InstanceUtilities, useValue: instUtils },
        { provide: Store, useValue: store },
        { provide: MatDialog, useValue: dialog },
      ]
    });
    service = TestBed.inject(BookmarkUploadService);
  });

  /** Upload the passed file content. Reading the file itself is the browser's job. */
  function upload(content: string): void {
    service.uploadContent(content);
  }

  /** The dbIds bookmarked by the upload, in the order they were added. */
  function addedDbIds(): number[] {
    return store.dispatch.calls.allArgs()
      .map(args => args[0] as any)
      .filter(action => action.type === BookmarkActions.add_bookmark.type)
      .map(action => action.dbId);
  }

  function dialogData(): any {
    return dialog.open.calls.mostRecent().args[1]?.data;
  }

  describe('parseDbIds', () => {
    it('reads the dbId column of a file downloaded from an instance list', () => {
      // The download's own format, whose display names are quoted and may hold both commas
      // and numbers that must not be mistaken for a dbId.
      const parsed = service.parseDbIds([
        'dbId,displayName,schemaClass',
        '111,"Signaling by EGFR","Pathway"',
        '222,"Cleavage of 1,25 something","Reaction"',
        '333,"12345","Complex"'
      ].join('\n'));

      expect(parsed.dbIds).toEqual([111, 222, 333]);
      expect(parsed.unparsableLines).toEqual([]);
      expect(parsed.duplicateCount).toBe(0);
    });

    it('reads a bare list of dbIds with no header', () => {
      const parsed = service.parseDbIds('111\n222\n333\n');
      expect(parsed.dbIds).toEqual([111, 222, 333]);
      expect(parsed.unparsableLines).toEqual([]);
    });

    it('takes the first integer cell when there is no dbId header', () => {
      const parsed = service.parseDbIds('Pathway,111\nReaction,222');
      expect(parsed.dbIds).toEqual([111, 222]);
    });

    it('tolerates a BOM, CRLF line endings and blank lines', () => {
      const parsed = service.parseDbIds('﻿dbId,displayName\r\n111,"A"\r\n\r\n222,"B"\r\n');
      expect(parsed.dbIds).toEqual([111, 222]);
      expect(parsed.unparsableLines).toEqual([]);
    });

    it('keeps negative dbIds, which are this curator\'s own new instances', () => {
      const parsed = service.parseDbIds('-1\n-2');
      expect(parsed.dbIds).toEqual([-1, -2]);
    });

    it('counts a repeated dbId once and reports it', () => {
      const parsed = service.parseDbIds('111\n222\n111\n111');
      expect(parsed.dbIds).toEqual([111, 222]);
      expect(parsed.duplicateCount).toBe(2);
    });

    it('reports a line holding no dbId rather than guessing at one', () => {
      const parsed = service.parseDbIds('111\nR-HSA-12345\n12345 (obsolete)\n222');
      expect(parsed.dbIds).toEqual([111, 222]);
      expect(parsed.unparsableLines).toEqual(['R-HSA-12345', '12345 (obsolete)']);
    });

    it('does not read a dbId out of another column when a dbId header names one', () => {
      // 222 sits in the displayName column, so this line has no dbId of its own.
      const parsed = service.parseDbIds('displayName,dbId\n"A",111\n222,\n"C",333');
      expect(parsed.dbIds).toEqual([111, 333]);
      expect(parsed.unparsableLines).toEqual(['222,']);
    });

    it('stops at the upload limit and says how many dbIds it left out', () => {
      const dbIds = Array.from({ length: MAX_UPLOADED_DB_IDS + 3 }, (_, i) => i + 1);
      const parsed = service.parseDbIds(dbIds.join('\n'));
      expect(parsed.dbIds.length).toBe(MAX_UPLOADED_DB_IDS);
      expect(parsed.droppedForLimit).toBe(3);
    });
  });

  describe('parsePastedDbIds', () => {
    it('treats anything that is not a digit as a separator', () => {
      // A comma-separated list, a spreadsheet column and a line of dbIds all read the same.
      expect(service.parsePastedDbIds('111, 222, 333').dbIds).toEqual([111, 222, 333]);
      expect(service.parsePastedDbIds('111\n222\n333\n').dbIds).toEqual([111, 222, 333]);
      expect(service.parsePastedDbIds(' 111\t222 ;  333 ').dbIds).toEqual([111, 222, 333]);
      expect(service.parsePastedDbIds('[111][222][333]').dbIds).toEqual([111, 222, 333]);
    });

    it('reads dbIds out of surrounding prose rather than refusing the paste', () => {
      // The point of the paste box: whatever the dbIds arrived wrapped in comes along with them.
      const parsed = service.parsePastedDbIds('Please check Pathway 111 and Reaction 222, thanks');
      expect(parsed.dbIds).toEqual([111, 222]);
      expect(parsed.unparsableLines).toEqual([]);
    });

    it('keeps the sign of a negative dbId, which is a new not-yet-committed instance', () => {
      expect(service.parsePastedDbIds('-1, -2').dbIds).toEqual([-1, -2]);
      expect(service.parsePastedDbIds('111\n-1').dbIds).toEqual([111, -1]);
    });

    it('reads a minus joined to what precedes it as a separator, not as a sign', () => {
      // Otherwise a stable id would quietly become the dbId -111, and a range the dbId -222.
      expect(service.parsePastedDbIds('R-HSA-111').dbIds).toEqual([111]);
      expect(service.parsePastedDbIds('111-222').dbIds).toEqual([111, 222]);
    });

    it('counts a repeated dbId once and reports it', () => {
      const parsed = service.parsePastedDbIds('111 222 111 111');
      expect(parsed.dbIds).toEqual([111, 222]);
      expect(parsed.duplicateCount).toBe(2);
    });

    it('reports a run of digits that cannot be a dbId instead of dropping it silently', () => {
      const parsed = service.parsePastedDbIds('111 99999999999999999999 0 222');
      expect(parsed.dbIds).toEqual([111, 222]);
      expect(parsed.unparsableLines).toEqual(['99999999999999999999', '0']);
    });

    it('finds nothing in a paste holding no digits at all', () => {
      const parsed = service.parsePastedDbIds('no dbIds here');
      expect(parsed.dbIds).toEqual([]);
      expect(parsed.unparsableLines).toEqual([]);
    });

    it('stops at the upload limit and says how many dbIds it left out', () => {
      const dbIds = Array.from({ length: MAX_UPLOADED_DB_IDS + 3 }, (_, i) => i + 1);
      const parsed = service.parsePastedDbIds(dbIds.join(' '));
      expect(parsed.dbIds.length).toBe(MAX_UPLOADED_DB_IDS);
      expect(parsed.droppedForLimit).toBe(3);
    });
  });

  describe('uploadPastedText', () => {
    it('bookmarks every dbId pasted, in the order they were pasted', () => {
      service.uploadPastedText('333, 111, 222');

      expect(dataService.fetchInstanceInBatch).toHaveBeenCalledWith([333, 111, 222]);
      expect(addedDbIds()).toEqual([333, 111, 222]);
      expect(dialogData().message).toContain('Added 3 bookmarks');
    });

    it('adds nothing and explains itself when nothing usable was pasted', () => {
      service.uploadPastedText('no dbIds here');

      expect(dataService.fetchInstanceInBatch).not.toHaveBeenCalled();
      expect(store.dispatch).not.toHaveBeenCalled();
      expect(dialogData().message).toContain('No bookmarks were added');
      // Worded for a paste rather than for a file, which is not what was given.
      expect(dialogData().instanceInfo).toContain('No dbIds were pasted');
    });
  });

  describe('uploadContent', () => {
    it('bookmarks every dbId in the file, in the file\'s order', () => {
      upload('dbId,displayName\n333,"C"\n111,"A"\n222,"B"');

      expect(dataService.fetchInstanceInBatch).toHaveBeenCalledWith([333, 111, 222]);
      expect(addedDbIds()).toEqual([333, 111, 222]);
      expect(dialogData().message).toContain('Added 3 bookmarks');
    });

    it('bookmarks the instance as a shell, as every other way of bookmarking does', () => {
      upload('111');

      const action = store.dispatch.calls.mostRecent().args[0] as any;
      expect(action.type).toBe(BookmarkActions.add_bookmark.type);
      expect(action.dbId).toBe(111);
      expect(action.schemaClassName).toBe('Pathway');
      expect(action.displayName).toBe('inst-111');
    });

    it('reports the dbIds with no instance behind them and bookmarks the rest', () => {
      // findByDbIds leaves out a dbId it cannot find rather than failing the request.
      dataService.fetchInstanceInBatch.and.returnValue(of([makeInstance(111)]));

      upload('111\n999');

      expect(addedDbIds()).toEqual([111]);
      expect(dialogData().message).toContain('Added 1 bookmark');
      expect(dialogData().instanceInfo).toContain('999');
    });

    it('leaves an already bookmarked instance alone instead of re-adding it', () => {
      bookmarks = [makeInstance(111)];

      upload('111\n222');

      expect(dataService.fetchInstanceInBatch).toHaveBeenCalledWith([222]);
      expect(addedDbIds()).toEqual([222]);
      expect(dialogData().message).toContain('1 of the dbIds was already bookmarked');
    });

    it('never looks up a new instance that was discarded before being committed', () => {
      removedNewDbIds = [-1];

      upload('-1\n222');

      expect(dataService.fetchInstanceInBatch).toHaveBeenCalledWith([222]);
      expect(addedDbIds()).toEqual([222]);
    });

    it('adds nothing and explains itself when the file holds no dbIds', () => {
      upload('dbId,displayName\n');

      expect(dataService.fetchInstanceInBatch).not.toHaveBeenCalled();
      expect(store.dispatch).not.toHaveBeenCalled();
      expect(dialogData().message).toContain('No bookmarks were added');
      expect(dialogData().instanceInfo).toContain('no dbIds');
    });

    it('does not report an upload that failed on the way to the server', () => {
      // The failure already raises the app-wide error banner; a "nothing was added" dialog
      // on top of it would be reporting a result the upload never reached.
      dataService.fetchInstanceInBatch.and.returnValue(throwError(() => new Error('HTTP 500 error')));

      upload('111');

      expect(store.dispatch).not.toHaveBeenCalled();
      expect(dialog.open).not.toHaveBeenCalled();
    });
  });
});
