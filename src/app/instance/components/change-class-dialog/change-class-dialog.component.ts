import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { SchemaAttribute } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';

/**
 * Data passed to the change-class dialog: the instance whose schema class is to be changed.
 */
export interface ChangeClassDialogData {
  instance: Instance;
}

/** A referrer attribute that references the instance, paired with its schema definition. */
interface ReferrerConstraint {
  referrer: Instance;
  attributeName: string;
  attribute: SchemaAttribute;
}

/** A referrer whose attribute would no longer accept the instance under the selected class. */
export interface ReferrerConflict {
  referrerDisplayName: string;
  referrerDbId: number;
  attributeName: string;
  allowedClasses: string[];
}

/**
 * Dialog to change an instance's schema class. Any concrete class may be chosen. Before the
 * change is allowed, every referrer's attribute is checked to make sure the instance still
 * qualifies under the new class; if any referrer would be invalidated, the change is blocked and
 * the offending referrers are listed. Returns the chosen class name, or undefined if cancelled.
 */
@Component({
  selector: 'app-change-class-dialog',
  templateUrl: './change-class-dialog.component.html',
  styleUrls: ['./change-class-dialog.component.scss']
})
export class ChangeClassDialogComponent implements OnInit {
  candidateClasses: string[] = [];
  selected: string = '';
  currentClass: string;
  loading = true;
  conflicts: ReferrerConflict[] = [];
  private constraints: ReferrerConstraint[] = [];

  constructor(
    public dialogRef: MatDialogRef<ChangeClassDialogComponent, string>,
    @Inject(MAT_DIALOG_DATA) public data: ChangeClassDialogData,
    private dataService: DataService,
    private instUtils: InstanceUtilities
  ) {
    this.currentClass = data.instance.schemaClassName;
  }

  ngOnInit(): void {
    // Load the full class hierarchy (for the concrete-class list and descendant checks), then the
    // instance's referrers and their attribute definitions, before enabling the picker.
    this.dataService.fetchSchemaClassTree(false).subscribe(root => {
      const concrete = new Set<string>();
      this.dataService.grepConcreteClasses(root, concrete);
      this.candidateClasses = [...concrete].filter(name => name !== this.currentClass).sort();
      this.loadReferrerConstraints();
    });
  }

  private loadReferrerConstraints(): void {
    this.dataService.getReferrers(this.data.instance.dbId).subscribe(referrers => {
      const classNames = new Set<string>();
      referrers.forEach(ref => ref.referrers.forEach(r => {
        if (r.schemaClassName) classNames.add(r.schemaClassName);
      }));
      if (classNames.size === 0) {
        this.loading = false;
        return;
      }
      // Fetch each referrer class WITH attributes so we can read the referring attribute's
      // allowedClases and decide whether the new class still qualifies.
      this.dataService.fetchSchemaClasses([...classNames]).subscribe(schemaClasses => {
        const name2class = new Map(schemaClasses.map(sc => [sc.name, sc]));
        referrers.forEach(ref => {
          ref.referrers.forEach(r => {
            const attribute = name2class.get(r.schemaClassName)?.attributes?.find(a => a.name === ref.attributeName);
            if (attribute)
              this.constraints.push({ referrer: r, attributeName: ref.attributeName, attribute });
          });
        });
        this.loading = false;
      });
    });
  }

  onSelectionChange(): void {
    this.conflicts = this.constraints
      .filter(c => !this.instUtils.isClassAllowedForAttribute(this.selected, c.attribute, this.dataService))
      .map(c => ({
        referrerDisplayName: c.referrer.displayName ?? '',
        referrerDbId: c.referrer.dbId,
        attributeName: c.attributeName,
        allowedClasses: c.attribute.allowedClases ?? []
      }));
  }

  /** Open a conflicting referrer in a new browser tab so its references can be resolved. */
  openReferrer(dbId: number): void {
    if (dbId === undefined || dbId === null)
      return;
    window.open(`schema_view/instance/${dbId}`, '_blank');
  }

  /** True when a different, referrer-compatible class is selected and referrers have loaded. */
  get canApply(): boolean {
    return !this.loading && !!this.selected && this.selected !== this.currentClass && this.conflicts.length === 0;
  }

  onOK(): void {
    if (this.canApply)
      this.dialogRef.close(this.selected);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
