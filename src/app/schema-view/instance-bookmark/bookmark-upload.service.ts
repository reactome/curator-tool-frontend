import { Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Store } from "@ngrx/store";
import { Observable, map, of, take } from "rxjs";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { DataService } from "src/app/core/services/data.service";
import { InstanceUtilities } from "src/app/core/services/instance.service";
import { InfoDialogComponent } from "src/app/shared/components/info-dialog/info-dialog.component";
import { BookmarkActions } from "./state/bookmark.actions";
import { bookmarkedInstances } from "./state/bookmark.selectors";

/**
 * The dbIds pulled out of an uploaded file or a pasted list, together with whatever could not be
 * used, so the curator is told what was skipped instead of quietly ending up with fewer bookmarks
 * than they named.
 */
export interface ParsedDbIds {
  dbIds: number[]; // unique, in the order they appear in the input
  duplicateCount: number; // dbIds listed more than once (counted once per extra occurrence)
  unparsableLines: string[]; // non-empty lines (or pasted values) holding no dbId at all
  droppedForLimit: number; // dbIds beyond MAX_UPLOADED_DB_IDS, which were not looked up
  source: DbIdSource; // where the dbIds came from, which is what the report is worded for
}

/** A file of dbIds, or dbIds pasted straight into the dialog. */
export type DbIdSource = 'file' | 'text';

/**
 * What an upload actually did, used to report back to the curator.
 */
export interface BookmarkUploadResult {
  added: Instance[]; // instances newly added to the bookmark list
  alreadyBookmarked: number[]; // dbIds that were bookmarked before the upload
  notFound: number[]; // dbIds with no instance behind them
  parsed: ParsedDbIds;
}

/**
 * A bookmark list is meant to be a working set of instances, and the panel showing it is a single
 * narrow column. Loading a whole search result into it would make it unusable, so an upload is
 * capped and the curator is told when the cap was hit.
 */
export const MAX_UPLOADED_DB_IDS = 500;

/**
 * Adds bookmarks in bulk from a list of dbIds, given either as a file - typically a CSV/TSV
 * downloaded from an instance list, whose first column is the dbId - or as text pasted straight
 * into the dialog.
 */
@Injectable({
  providedIn: 'root'
})
export class BookmarkUploadService {

  constructor(private store: Store,
    private dataService: DataService,
    private instUtils: InstanceUtilities,
    private dialog: MatDialog) {
  }

  /**
   * Read the file, add a bookmark for every dbId in it that resolves to an instance, and report
   * what happened in a dialog.
   */
  uploadFile(file: File): void {
    file.text()
      .then(content => this.uploadContent(content))
      .catch(() => this.dialog.open(InfoDialogComponent, {
        data: {
          title: 'Add Bookmarks',
          message: 'The selected file could not be read.'
        }
      }));
  }

  /**
   * The upload itself, on the content of the file: add a bookmark for every dbId that resolves to
   * an instance and report what happened in a dialog.
   */
  uploadContent(content: string): void {
    this.upload(this.parseDbIds(content));
  }

  /**
   * Add a bookmark for every dbId in the pasted text that resolves to an instance, and report what
   * happened in a dialog.
   */
  uploadPastedText(text: string): void {
    this.upload(this.parsePastedDbIds(text));
  }

  private upload(parsed: ParsedDbIds): void {
    if (parsed.dbIds.length === 0) {
      this.showResult(undefined, parsed);
      return;
    }
    this.addBookmarks(parsed).subscribe({
      next: result => this.showResult(result, parsed),
      // A failed lookup already raises the app-wide error banner (see
      // DataService.handleErrorMessage), so there is nothing to add here beyond not
      // leaving the curator with a half-reported upload.
      error: () => { }
    });
  }

  /**
   * Pull the dbIds out of the text of an uploaded file.
   *
   * The file is read as CSV, one record per line. If the first line is a header naming a dbId
   * column (as the instance list's download does), only that column is read; otherwise the first
   * cell of each line holding an integer is taken as its dbId, so a bare list of dbIds and a
   * `dbId,displayName,schemaClass` export both work. Negative dbIds are kept: they are this
   * curator's own new, not-yet-committed instances, which can be bookmarked like any other.
   */
  parseDbIds(content: string): ParsedDbIds {
    const found: number[] = [];
    const unparsableLines: string[] = [];

    // Strip a UTF-8 BOM, which a spreadsheet export puts in front of the first header cell and
    // which would otherwise keep it from being recognized.
    const lines = content.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
    let dbIdColumn = -1;
    let firstDataLine = 0;
    const headerCells = lines.length > 0 ? this.splitCsvLine(lines[0]) : [];
    const headerIndex = headerCells.findIndex(cell => cell.trim().toLowerCase() === 'dbid');
    if (headerIndex >= 0) {
      dbIdColumn = headerIndex;
      firstDataLine = 1;
    }

    for (let i = firstDataLine; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length === 0)
        continue; // A blank line (including the trailing newline's) is not something to report
      const cells = this.splitCsvLine(line);
      const candidates = dbIdColumn >= 0 ? [cells[dbIdColumn] ?? ''] : cells;
      const dbId = candidates.map(cell => this.toDbId(cell)).find(parsed => parsed !== undefined);
      if (dbId === undefined) {
        unparsableLines.push(line.trim());
        continue;
      }
      found.push(dbId);
    }

    return this.collect(found, unparsableLines, 'file');
  }

  /**
   * Pull the dbIds out of text pasted into the dialog.
   *
   * Anything that is not a digit separates one dbId from the next, so a column copied out of a
   * spreadsheet, a comma-separated list out of an email and a line of dbIds typed by hand all read
   * the same and there is nothing for the curator to tidy up first.
   *
   * The one exception is a minus sign standing on its own in front of a run of digits - at the
   * start of the paste, or after a space, a comma or a newline: that is read as the number's sign,
   * so a new, not-yet-committed instance - whose dbId is negative - can be pasted exactly as it is
   * shown rather than silently turning into the different, real instance with the same digits. A
   * minus joined to what is in front of it is a separator like any other non-digit, so a stable id
   * ("R-HSA-111") and a range ("111-222") are not read as negative dbIds.
   */
  parsePastedDbIds(text: string): ParsedDbIds {
    const found: number[] = [];
    const unparsable: string[] = [];
    for (const match of text.matchAll(/-?\d+/g)) {
      const start = match.index ?? 0;
      const signed = match[0].startsWith('-') && !/\w/.test(text[start - 1] ?? '');
      const token = signed ? match[0] : match[0].replace('-', '');
      const dbId = this.toDbId(token);
      if (dbId === undefined)
        unparsable.push(token); // A run of digits too long to be a dbId, or a bare zero
      else
        found.push(dbId);
    }
    return this.collect(found, unparsable, 'text');
  }

  /**
   * Reduce the dbIds read out of a file or a paste to the set that will actually be looked up:
   * each one once, in the order it was first named, and no more of them than the panel can hold.
   */
  private collect(found: number[], unparsableLines: string[], source: DbIdSource): ParsedDbIds {
    const dbIds: number[] = [];
    const seen = new Set<number>();
    let duplicateCount = 0;
    for (const dbId of found) {
      if (seen.has(dbId)) {
        duplicateCount++;
        continue;
      }
      seen.add(dbId);
      dbIds.push(dbId);
    }
    return {
      dbIds: dbIds.slice(0, MAX_UPLOADED_DB_IDS),
      duplicateCount,
      unparsableLines,
      droppedForLimit: Math.max(0, dbIds.length - MAX_UPLOADED_DB_IDS),
      source
    };
  }

  /**
   * Look the parsed dbIds up and bookmark the ones that exist. Instances already bookmarked are
   * left alone rather than re-added, so an upload that overlaps the current list neither
   * duplicates rows nor reorders them.
   */
  private addBookmarks(parsed: ParsedDbIds): Observable<BookmarkUploadResult> {
    const bookmarked = new Set(this.currentBookmarkDbIds());
    const alreadyBookmarked = parsed.dbIds.filter(dbId => bookmarked.has(dbId));
    // A new instance that was discarded before ever being committed no longer exists anywhere,
    // and the bookmark list drops such an instance on sight (see BookmarkListComponent), so
    // never look it up in the first place.
    const toFetch = parsed.dbIds.filter(dbId => !bookmarked.has(dbId)
      && !this.instUtils.isPermanentlyRemovedNewInstance(dbId));
    if (toFetch.length === 0) {
      const notFound = parsed.dbIds.filter(dbId => !bookmarked.has(dbId));
      return of({ added: [], alreadyBookmarked, notFound, parsed });
    }
    return this.dataService.fetchInstanceInBatch(toFetch).pipe(
      map((instances: Instance[]) => {
        // findByDbIds simply leaves out a dbId it cannot find, so what came back is the set
        // that exists and everything else in the request is gone (or never existed).
        const found = new Map<number, Instance>();
        (instances || []).forEach(inst => {
          if (inst && inst.dbId !== undefined && inst.dbId !== null)
            found.set(inst.dbId, inst);
        });
        const added: Instance[] = [];
        // Keep the file's order: dispatching in order means the new bookmarks read the same
        // way in the panel as they do in the file.
        toFetch.forEach(dbId => {
          const inst = found.get(dbId);
          if (!inst)
            return;
          const shell = this.instUtils.makeShell(inst);
          this.store.dispatch(BookmarkActions.add_bookmark(shell));
          added.push(shell);
        });
        const notFound = parsed.dbIds.filter(dbId => !bookmarked.has(dbId) && !found.has(dbId));
        return { added, alreadyBookmarked, notFound, parsed };
      })
    );
  }

  private currentBookmarkDbIds(): number[] {
    let dbIds: number[] = [];
    this.store.select(bookmarkedInstances()).pipe(take(1)).subscribe((instances: Instance[] | undefined) => {
      dbIds = (instances || []).filter(inst => inst && inst.dbId !== undefined && inst.dbId !== null)
        .map(inst => inst.dbId);
    });
    return dbIds;
  }

  /**
   * A cell holds a dbId if the whole of it is an integer. Anything else - a display name, a
   * schema class, a header cell - is not a dbId, and a value such as "12345 (obsolete)" is
   * refused rather than silently read as 12345.
   */
  private toDbId(cell: string | undefined): number | undefined {
    const trimmed = (cell ?? '').trim();
    if (!/^-?\d+$/.test(trimmed))
      return undefined;
    const dbId = Number(trimmed);
    return Number.isSafeInteger(dbId) && dbId !== 0 ? dbId : undefined;
  }

  /**
   * Split one CSV record into its cells, honouring double-quoted values (in which "" is an
   * escaped quote). Only single-line records are supported: a quoted value containing a newline
   * would be split across lines, which is why a line with no dbId in it is reported rather than
   * assumed to be a continuation.
   */
  private splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip the second quote of the escaped pair
        }
        else
          inQuotes = !inQuotes;
      }
      else if ((char === ',' || char === '\t') && !inQuotes) {
        cells.push(current);
        current = '';
      }
      else
        current += char;
    }
    cells.push(current);
    return cells;
  }

  private showResult(result: BookmarkUploadResult | undefined, parsed: ParsedDbIds): void {
    const messages: string[] = [];
    if (!result || result.added.length === 0)
      messages.push('No bookmarks were added.');
    else
      messages.push(`Added ${result.added.length} bookmark${result.added.length === 1 ? '' : 's'}.`);
    if (result && result.alreadyBookmarked.length > 0)
      messages.push(`${result.alreadyBookmarked.length} of the dbIds ${result.alreadyBookmarked.length === 1 ? 'was' : 'were'} already bookmarked.`);
    if (parsed.duplicateCount > 0)
      messages.push(`${parsed.duplicateCount} repeated dbId${parsed.duplicateCount === 1 ? '' : 's'} ${parsed.source === 'file' ? 'in the file ' : ''}${parsed.duplicateCount === 1 ? 'was' : 'were'} read once.`);
    if (parsed.droppedForLimit > 0)
      messages.push(`Only the first ${MAX_UPLOADED_DB_IDS} dbIds were used; the remaining ${parsed.droppedForLimit} were ignored.`);

    const details: string[] = [];
    if (result && result.notFound.length > 0)
      details.push(`No instance was found for: ${this.listForDisplay(result.notFound.map(dbId => dbId.toString()))}`);
    if (parsed.unparsableLines.length > 0)
      details.push(parsed.source === 'file'
        ? `No dbId was found in ${parsed.unparsableLines.length} line${parsed.unparsableLines.length === 1 ? '' : 's'}: ${this.listForDisplay(parsed.unparsableLines)}`
        : `${parsed.unparsableLines.length} value${parsed.unparsableLines.length === 1 ? '' : 's'} ${parsed.unparsableLines.length === 1 ? 'is' : 'are'} not a usable dbId: ${this.listForDisplay(parsed.unparsableLines)}`);
    if (parsed.dbIds.length === 0 && parsed.unparsableLines.length === 0 && parsed.droppedForLimit === 0)
      details.push(parsed.source === 'file'
        ? 'The file held no dbIds. Expected a CSV or TSV whose first column holds the dbId of each instance.'
        : 'No dbIds were pasted. Expected the dbIds of the instances to bookmark, separated by anything that is not a digit.');

    this.dialog.open(InfoDialogComponent, {
      data: {
        title: 'Add Bookmarks',
        message: messages.join(' '),
        instanceInfo: details.join(' ')
      }
    });
  }

  /**
   * A comma-separated list, shortened so a file full of bad rows still gives a readable dialog.
   */
  private listForDisplay(values: string[]): string {
    const shown = values.slice(0, 10);
    const rest = values.length - shown.length;
    return shown.join(', ') + (rest > 0 ? `, and ${rest} more` : '');
  }
}
