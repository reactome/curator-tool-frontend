import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, concatMap, EMPTY, map, Observable, take } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { DatabaseMergeError, DatabaseMergeOutcome, DatabaseMergeService } from 'src/app/core/services/database-merge.service';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import { MergeWithDatabaseDialogComponent, MergeWithDatabaseDialogData } from './merge-with-database-dialog.component';

/**
 * Drives the "merge my staged copy with the database copy" interaction: read the database copy,
 * show the differences, apply the curator's choice. Emits the outcome once applied, or completes
 * empty if the curator cancels or the merge cannot be prepared (the reason is shown in a dialog).
 */
@Injectable({ providedIn: 'root' })
export class MergeWithDatabaseDialogService {

  constructor(private dialog: MatDialog,
    private mergeService: DatabaseMergeService) {
  }

  /**
   * @param instance the staged instance (a shell is fine; the full staged copy is read from the cache)
   * @param reason optional explanation shown at the top, e.g. why a commit was rejected
   */
  merge(instance: Instance, reason?: string): Observable<DatabaseMergeOutcome> {
    return this.mergeService.prepare(instance.dbId).pipe(
      catchError(error => {
        // DataService.handleErrorMessage has already shown HTTP failures in the error banner;
        // the errors raised by prepare() itself explain why the merge is not possible.
        if (error instanceof DatabaseMergeError)
          this.info(error.message);
        return EMPTY;
      }),
      concatMap(merge => {
        const data: MergeWithDatabaseDialogData = { merge, reason };
        return this.dialog.open(MergeWithDatabaseDialogComponent, {
          width: '1000px',
          maxHeight: '90vh',
          data
        }).afterClosed().pipe(
          take(1),
          concatMap(confirmed => confirmed ? [merge] : EMPTY),
          map(confirmedMerge => this.mergeService.apply(confirmedMerge))
        );
      })
    );
  }

  private info(message: string): void {
    this.dialog.open(InfoDialogComponent, {
      data: { title: 'Cannot Merge', message }
    });
  }
}
