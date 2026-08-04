import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { take } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeDataType, SchemaAttribute, SchemaClass } from 'src/app/core/models/reactome-schema.model';
import {
  InstanceMergeService,
  MAX_MERGE_REFERRERS,
  MergeAttributeSelection,
  MergeTargetClass
} from 'src/app/core/services/instance-merge.service';

/** Which of the two instances a value came from. */
export type MergeSide = 'first' | 'second';

/** The two ways two instances can be merged. */
export type MergeMode = 'new-instance' | 'merge-into';

export interface MergeInstancesDialogData {
  /** The instance the merge was started from, fully loaded. */
  first: Instance;
  /** The instance the curator picked to merge with, fully loaded. */
  second: Instance;
  /** The resolved class for a merged (third) instance, with its attributes loaded. */
  targetClass: MergeTargetClass;
  /** Mergeable attributes of targetClass.schemaClass, in display order. */
  attributes: SchemaAttribute[];
}

export type MergeInstancesDialogResult =
  | {
    mode: 'new-instance';
    schemaClass: SchemaClass;
    selections: MergeAttributeSelection[];
  }
  | {
    mode: 'merge-into';
    /** The instance whose values are copied over and which is then deleted. */
    source: Instance;
    /** The instance that receives the values and the references. */
    target: Instance;
  };

/** One selectable value of one attribute, on one side of the merge. */
interface ValueOption {
  side: MergeSide;
  value: any;
  label: string;
  selected: boolean;
}

/** One attribute row of the pick-and-choose table. */
interface MergeRow {
  attribute: SchemaAttribute;
  multiValued: boolean;
  firstOptions: ValueOption[];
  secondOptions: ValueOption[];
  /** Single-valued rows are a three-way choice rather than a set of checkboxes. */
  singleChoice: MergeSide | 'none';
  /** True when at least one side holds a value; used by the "hide empty attributes" filter. */
  hasValues: boolean;
}

/** A line of the merge-into preview: what the merge will do to one attribute of the target. */
interface MergeIntoPreviewRow {
  attributeName: string;
  effect: string;
  detail: string;
}

/**
 * Dialog for merging two instances. The curator either builds a brand new instance by picking
 * values attribute by attribute from both originals, or merges one instance into the other:
 * the source's single-valued attributes overwrite the target's, its multivalued attributes are
 * appended to the target's lists, references to the source move to the target and the source is
 * staged for deletion.
 */
@Component({
  selector: 'app-merge-instances-dialog',
  templateUrl: './merge-instances-dialog.component.html',
  styleUrls: ['./merge-instances-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ]
})
export class MergeInstancesDialogComponent {
  /** Attributes where neither instance holds a value are hidden by default to keep the table short. */
  hideEmptyAttributes: boolean = true;
  /** Bound by the two value columns; a field rather than an inline literal so *ngFor is stable. */
  readonly sides: MergeSide[] = ['first', 'second'];
  readonly maxReferrers = MAX_MERGE_REFERRERS;

  readonly first: Instance;
  readonly second: Instance;
  readonly targetClass: MergeTargetClass;
  readonly rows: MergeRow[];

  /**
   * Rebuilt only when the direction changes rather than exposed as a getter: the rows are freshly
   * created objects, so recomputing them on every change-detection cycle would re-render the
   * whole preview table each time.
   */
  mergeIntoPreview: MergeIntoPreviewRow[] = [];
  /** True while the referrer count of the current source is being fetched. */
  countingReferrers: boolean = false;

  private _mode: MergeMode = 'new-instance';
  /** For 'merge-into': which instance is merged away into the other. */
  private _mergeIntoSource: MergeSide = 'second';
  /**
   * dbId -> number of instances referring to it. Filled lazily, and only for a merge-into: the
   * getReferrers call is a heavy server transaction, so it is not run for curators who only ever
   * use the pick-and-choose mode.
   */
  private readonly referrerCounts = new Map<number, number>();

  constructor(@Inject(MAT_DIALOG_DATA) public data: MergeInstancesDialogData,
    public dialogRef: MatDialogRef<MergeInstancesDialogComponent, MergeInstancesDialogResult>,
    private mergeService: InstanceMergeService) {
    this.first = data.first;
    this.second = data.second;
    this.targetClass = data.targetClass;
    this.rows = this.buildRows(data.attributes);
    this.mergeIntoPreview = this.buildMergeIntoPreview();
  }

  get mode(): MergeMode {
    return this._mode;
  }

  set mode(mode: MergeMode) {
    this._mode = mode;
    if (mode === 'merge-into')
      this.loadReferrerCount();
  }

  get mergeIntoSource(): MergeSide {
    return this._mergeIntoSource;
  }

  set mergeIntoSource(side: MergeSide) {
    this._mergeIntoSource = side;
    this.mergeIntoPreview = this.buildMergeIntoPreview();
    this.loadReferrerCount();
  }

  /** Referrers of the instance being merged away, or undefined while still counting. */
  get sourceReferrerCount(): number | undefined {
    return this.referrerCounts.get(this.sourceInstance.dbId);
  }

  /**
   * A merge-into stages one update per referrer, so refuse to start one that would blow past the
   * staging limit rather than leave the curator with an uncommittable pile of changes.
   */
  get exceedsReferrerLimit(): boolean {
    return (this.sourceReferrerCount ?? 0) > MAX_MERGE_REFERRERS;
  }

  private loadReferrerCount(): void {
    const dbId = this.sourceInstance.dbId;
    if (this.referrerCounts.has(dbId))
      return;
    this.countingReferrers = true;
    // Flipping the direction back and forth can leave an older request in flight; only the one
    // for the source currently on screen may clear the spinner.
    const isStillCurrent = () => this.sourceInstance.dbId === dbId;
    this.mergeService.countReferrers(dbId).pipe(take(1)).subscribe({
      next: count => {
        this.referrerCounts.set(dbId, count);
        if (isStillCurrent())
          this.countingReferrers = false;
      },
      error: () => {
        if (isStillCurrent())
          this.countingReferrers = false;
      }
    });
  }

  /* ---------------------------------------------------------------- labels */

  instanceLabel(instance: Instance): string {
    return `${instance.displayName} [${instance.dbId}] (${instance.schemaClassName})`;
  }

  get sourceInstance(): Instance {
    return this.mergeIntoSource === 'first' ? this.first : this.second;
  }

  get targetInstance(): Instance {
    return this.mergeIntoSource === 'first' ? this.second : this.first;
  }

  /* -------------------------------------------------- pick-and-choose mode */

  get visibleRows(): MergeRow[] {
    return this.hideEmptyAttributes ? this.rows.filter(row => row.hasValues) : this.rows;
  }

  optionsFor(row: MergeRow, side: MergeSide): ValueOption[] {
    return side === 'first' ? row.firstOptions : row.secondOptions;
  }

  /** Take every value of one side and nothing from the other. */
  selectSide(row: MergeRow, side: MergeSide): void {
    if (row.multiValued) {
      row.firstOptions.forEach(option => option.selected = side === 'first');
      row.secondOptions.forEach(option => option.selected = side === 'second');
    } else {
      row.singleChoice = this.optionsFor(row, side).length > 0 ? side : 'none';
    }
  }

  /** Take the union of both sides. Duplicates are dropped when the selection is collected. */
  selectBoth(row: MergeRow): void {
    if (!row.multiValued) return;
    row.firstOptions.forEach(option => option.selected = true);
    row.secondOptions.forEach(option => option.selected = true);
  }

  clearRow(row: MergeRow): void {
    if (row.multiValued) {
      row.firstOptions.forEach(option => option.selected = false);
      row.secondOptions.forEach(option => option.selected = false);
    } else {
      row.singleChoice = 'none';
    }
  }

  /** Apply a whole-column shortcut to every currently visible row. */
  selectAllRows(side: MergeSide): void {
    this.visibleRows.forEach(row => this.selectSide(row, side));
  }

  selectBothForAllRows(): void {
    this.visibleRows.forEach(row => row.multiValued ? this.selectBoth(row) : undefined);
  }

  clearAllRows(): void {
    this.visibleRows.forEach(row => this.clearRow(row));
  }

  /* -------------------------------------------------- merge-into preview */

  private buildMergeIntoPreview(): MergeIntoPreviewRow[] {
    const source = this.sourceInstance;
    const target = this.targetInstance;
    const preview: MergeIntoPreviewRow[] = [];
    // Mirror exactly what applyMergeAttributes() will copy: attributes the target's own class
    // defines and that a merge is allowed to touch. This is not data.attributes, which describes
    // the class a new merged instance would live in and can differ from the target's class.
    const targetAttributes = new Map<string, SchemaAttribute>(
      this.mergeService.getMergeableAttributes(target.schemaClass).map(attribute => [attribute.name, attribute]));

    for (const attribute of source.schemaClass?.attributes ?? []) {
      const targetAttribute = targetAttributes.get(attribute.name);
      if (!targetAttribute)
        continue;
      const sourceValues = this.toValues(source, attribute.name);
      if (sourceValues.length === 0)
        continue;

      if (targetAttribute.cardinality === '1') {
        const targetValues = this.toValues(target, attribute.name);
        preview.push({
          attributeName: attribute.name,
          effect: targetValues.length > 0 ? 'Overwrite' : 'Set',
          detail: targetValues.length > 0
            ? `${this.label(targetValues[0], attribute)} → ${this.label(sourceValues[0], attribute)}`
            : this.label(sourceValues[0], attribute)
        });
      } else {
        const targetValues = this.toValues(target, attribute.name);
        const added = sourceValues.filter(value => !targetValues.some(existing => this.isSameValue(existing, value)));
        preview.push({
          attributeName: attribute.name,
          effect: added.length > 0 ? `Append ${added.length}` : 'No change',
          detail: added.length > 0
            ? added.map(value => this.label(value, attribute)).join(', ')
            : 'all values already present'
        });
      }
    }
    return preview;
  }

  /* ------------------------------------------------------------- actions */

  /** The merged instance must end up with at least one value, or there is nothing to create. */
  get hasSelection(): boolean {
    return this.rows.some(row => row.multiValued
      ? row.firstOptions.some(o => o.selected) || row.secondOptions.some(o => o.selected)
      : row.singleChoice !== 'none');
  }

  isValid(): boolean {
    if (this.mode === 'merge-into')
      return !this.countingReferrers && !this.exceedsReferrerLimit;
    return this.hasSelection;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onOK(): void {
    if (this.mode === 'merge-into') {
      this.dialogRef.close({
        mode: 'merge-into',
        source: this.sourceInstance,
        target: this.targetInstance
      });
      return;
    }
    this.dialogRef.close({
      mode: 'new-instance',
      schemaClass: this.targetClass.schemaClass,
      selections: this.collectSelections()
    });
  }

  private collectSelections(): MergeAttributeSelection[] {
    const selections: MergeAttributeSelection[] = [];
    for (const row of this.rows) {
      if (row.multiValued) {
        // The first instance's values come first, then the second's, so the merged list reads
        // in the same order the two columns are shown.
        const values: any[] = [];
        for (const option of [...row.firstOptions, ...row.secondOptions]) {
          if (!option.selected) continue;
          if (values.some(value => this.isSameValue(value, option.value))) continue;
          values.push(option.value);
        }
        if (values.length > 0)
          selections.push({ attributeName: row.attribute.name, values });
      } else if (row.singleChoice !== 'none') {
        const option = this.optionsFor(row, row.singleChoice)[0];
        if (option)
          selections.push({ attributeName: row.attribute.name, values: [option.value] });
      }
    }
    return selections;
  }

  /* ------------------------------------------------------------- building */

  private buildRows(attributes: SchemaAttribute[]): MergeRow[] {
    return attributes.map(attribute => {
      const multiValued = attribute.cardinality !== '1';
      const firstOptions = this.toOptions(this.first, attribute, 'first');
      const secondOptions = this.toOptions(this.second, attribute, 'second');
      const row: MergeRow = {
        attribute,
        multiValued,
        firstOptions,
        secondOptions,
        singleChoice: 'none',
        hasValues: firstOptions.length > 0 || secondOptions.length > 0
      };
      // Default to the most common intent: keep everything for a list, and prefer the instance
      // the merge was started from for a single-valued slot.
      if (multiValued)
        this.selectBoth(row);
      else if (firstOptions.length > 0)
        row.singleChoice = 'first';
      else if (secondOptions.length > 0)
        row.singleChoice = 'second';
      return row;
    });
  }

  private toOptions(instance: Instance, attribute: SchemaAttribute, side: MergeSide): ValueOption[] {
    return this.toValues(instance, attribute.name).map(value => ({
      side,
      value,
      label: this.label(value, attribute),
      selected: false
    }));
  }

  private toValues(instance: Instance, attributeName: string): any[] {
    const value = instance.attributes?.get?.(attributeName);
    if (value === undefined || value === null)
      return [];
    const values = Array.isArray(value) ? value : [value];
    return values.filter(v => v !== undefined && v !== null && v !== '');
  }

  private label(value: any, attribute: SchemaAttribute): string {
    if (value === undefined || value === null)
      return '';
    if (attribute.type === AttributeDataType.INSTANCE || (typeof value === 'object' && 'dbId' in value))
      return `${value.displayName ?? '(no name)'} [${value.dbId}]`;
    if (attribute.type === AttributeDataType.BOOLEAN)
      return value ? 'true' : 'false';
    return String(value);
  }

  /** Instances compare by dbId, everything else by value. Mirrors InstanceMergeService. */
  private isSameValue(left: any, right: any): boolean {
    if (left === right)
      return true;
    if (left && right && typeof left === 'object' && typeof right === 'object' && 'dbId' in left && 'dbId' in right)
      return left.dbId === right.dbId;
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
