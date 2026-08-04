import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { combineLatest, concatMap, EMPTY, map, Observable, of, take } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { InstanceMergeService } from 'src/app/core/services/instance-merge.service';
import { DataService } from 'src/app/core/services/data.service';
import { ListInstancesDialogService } from 'src/app/schema-view/list-instances/components/list-instances-dialog/list-instances-dialog.service';
import { InfoDialogComponent } from 'src/app/shared/components/info-dialog/info-dialog.component';
import {
  MergeInstancesDialogComponent,
  MergeInstancesDialogData,
  MergeInstancesDialogResult
} from './merge-instances-dialog.component';

/** What a completed merge produced, so the caller can navigate to it. */
export interface MergeOutcome {
  mode: 'new-instance' | 'merge-into';
  /** The new merged instance, or the instance that received the merge. */
  instance: Instance;
  /** For 'merge-into': the dbId of the instance that was merged away and marked for deletion. */
  sourceDbId?: number;
  /** For 'merge-into': how many referrers were repointed at the target. */
  changedReferrerCount?: number;
}

/**
 * Drives the whole "merge two instances" interaction: pick the second instance, resolve the
 * class the merged instance would live in, show the merge dialog and apply the curator's choice.
 *
 * Emits nothing (completes empty) if the curator cancels at any step.
 */
@Injectable({ providedIn: 'root' })
export class MergeInstancesDialogService {

  constructor(private dialog: MatDialog,
    private dataService: DataService,
    private mergeService: InstanceMergeService,
    private listInstancesDialogService: ListInstancesDialogService) {
  }

  /**
   * Start a merge from the passed instance. The curator picks the instance to merge with (the
   * list dialog also offers the ancestor classes, so the second instance need not be of the same
   * class), then chooses how the two should be combined.
   */
  merge(first: Instance): Observable<MergeOutcome> {
    return this.pickSecondInstance(first).pipe(
      concatMap(second => this.openMergeDialog(first, second)),
      concatMap(result => this.apply(result))
    );
  }

  private pickSecondInstance(first: Instance): Observable<Instance> {
    const schemaClass = this.dataService.getSchemaClass(first.schemaClassName);
    return this.listInstancesDialogService.openDialog({
      schemaClass,
      title: 'Merge ' + first.displayName + ' with'
    }).afterClosed().pipe(
      take(1),
      concatMap(picked => {
        if (!picked || picked.dbId === undefined)
          return EMPTY;
        if (picked.dbId === first.dbId) {
          this.info('An instance cannot be merged with itself.');
          return EMPTY;
        }
        // The list dialog returns a shell row; the merge needs the full attributes and class.
        return this.dataService.fetchInstance(picked.dbId).pipe(
          take(1),
          concatMap(instance => this.dataService.handleSchemaClassForInstance(instance).pipe(take(1)))
        );
      })
    );
  }

  private openMergeDialog(first: Instance, second: Instance): Observable<MergeInstancesDialogResult> {
    // Both instances need their attributes loaded before the two value columns can be built.
    return combineLatest([
      this.dataService.handleSchemaClassForInstance(first).pipe(take(1)),
      this.mergeService.resolveTargetSchemaClass(first, second).pipe(take(1))
    ]).pipe(
      concatMap(([loadedFirst, targetClass]) => {
        const data: MergeInstancesDialogData = {
          first: loadedFirst,
          second,
          targetClass,
          attributes: this.mergeService.getMergeableAttributes(targetClass.schemaClass)
        };
        return this.dialog.open(MergeInstancesDialogComponent, {
          width: '1100px',
          maxHeight: '85vh',
          data
        }).afterClosed().pipe(
          take(1),
          concatMap(result => result ? of(result) : EMPTY)
        );
      })
    );
  }

  private apply(result: MergeInstancesDialogResult): Observable<MergeOutcome> {
    if (result.mode === 'new-instance') {
      return this.mergeService.createMergedInstance(result.schemaClass, result.selections).pipe(
        take(1),
        map(instance => ({ mode: 'new-instance' as const, instance }))
      );
    }
    // The dialog already showed the referrer count and blocked a merge that would exceed the
    // staging limit, so clicking Merge there is the confirmation.
    return this.mergeService.mergeInto(result.source, result.target).pipe(
      take(1),
      map(mergeResult => ({
        mode: 'merge-into' as const,
        instance: mergeResult.target,
        sourceDbId: result.source.dbId,
        changedReferrerCount: mergeResult.changedReferrers.length
      }))
    );
  }

  private info(message: string): void {
    this.dialog.open(InfoDialogComponent, {
      data: { title: 'Information', message }
    });
  }
}
