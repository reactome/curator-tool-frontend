import { Component, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AttributeValue, Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import { Store } from '@ngrx/store';
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import { concatMap, from, Observable } from 'rxjs';
import { Pipe } from '@angular/core';
// Type-only: InstanceTableComponent's own module reaches this one (via NewInstanceDialogService),
// so importing it as a value here would create a circular dependency. `import type` is erased at
// compile time and never touches the runtime module graph.
import type { InstanceTableComponent } from 'src/app/instance/components/instance-view/instance-table/instance-table.component';

/**
 * The value returned when the create-new-instance dialog is confirmed.
 */
export interface NewInstanceDialogResult {
  instance: Instance | undefined;
}

/**
 * A dialog component that is used to create a new Instance object.
 *
 * <b>Note</b>: It is just too complexity to use rxjs store to manage new instance creation.
 * Here, we will use the data service directly.
 */
@Component({
  selector: 'app-new-instance-dialog',
  templateUrl: './new-instance-dialog.component.html',
  styleUrls: ['./new-instance-dialog.component.scss']
})
export class NewInstanceDialogComponent {
  selected: string = '';
  candidateClasses: string[] = [];
  instance: Instance | undefined;

  // So the "name" slot (see scrollToNameIfPresent()) can be scrolled into view once it's
  // rendered. Queried by template reference variable, not by type, to avoid a circular import
  // (see the note on the InstanceTableComponent import above). Only present while
  // attributeValue.editAction is 0 or 2 - see the template.
  @ViewChild('instanceTable') private instanceTable?: InstanceTableComponent;

  /**
   * Whether the dialog's own open (enter) animation has finished. The very first scroll to the
   * name row has to wait for this: attempted while the dialog is still mid-animation (transform:
   * scale() easing toward its final size), scrollToAttribute()'s measurements are taken against
   * that transient, not-yet-final layout, so the row lands a little off - close enough to look
   * intentional, but with its top clipped by the sticky header. A later scroll, from switching
   * the class after the dialog is already fully open, isn't affected the same way.
   */
  private dialogOpened = false;

  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public attributeValue: AttributeValue,
              public dialogRef: MatDialogRef<NewInstanceDialogComponent>,
              private dataService: DataService,
              private store: Store) {
      this.candidateClasses = dataService.setCandidateClasses(attributeValue.attribute);
      this.selected = this.candidateClasses![0];
      // Instance creation and the dialog's own open animation are two independent async things;
      // whichever finishes last is what actually triggers the scroll (scrollToNameIfPresent() is
      // a no-op until both have).
      this.dialogRef.afterOpened().subscribe(() => {
        this.dialogOpened = true;
        this.scrollToNameIfPresent();
      });
      this.dataService.createNewInstance(this.selected).subscribe(instance => {
        this.instance = instance;
        this.scrollToNameIfPresent();
      });
  }

  onSelectionChange(): void {
    // console.log('selected' + this.selected);
    // The following code will generate a new dbId even though we don't use that new instance.
    // This is a little bit wasteful but it is the simplest way to make sure the dbId is correctly generated and there is no need to handle the cache of new instance in the data service.
    this.dataService.createNewInstance(this.selected).subscribe(instance => {
        this.instance = instance;
        this.scrollToNameIfPresent();
      }
    );
  }

  /**
   * Almost every new instance needs its name filled in first, and on a class with many
   * attributes that slot can be well below the fold - tedious to hunt for on every single
   * instance created. Bring it into view automatically instead, if this class has one - once the
   * dialog has finished opening (see dialogOpened) and the instance has actually loaded.
   */
  private scrollToNameIfPresent(): void {
    if (!this.dialogOpened)
      return;
    if (!this.instance?.schemaClass?.attributes?.some(attribute => attribute.name === 'name'))
      return;
    // The table rebuilds its rows from the newly-bound instance on the next change detection
    // cycle; wait a tick so the "name" row actually exists in the DOM before looking for it.
    setTimeout(() => this.instanceTable?.scrollToAttribute('name'));
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    // Just return the instance newly created. Don't close it. The template
    // will handle close.
    if (this.instance) {
      this.dataService.registerInstance(this.instance);
      this.store.dispatch(NewInstanceActions.register_new_instance(this.instance));
    }
    const result: NewInstanceDialogResult = {
      instance: this.instance,
    };
    this.dialogRef.close(result);
  }

  // setCandidateClasses(attributeValue: AttributeValue) {
  //   // @ts-ignore
  //   let concreteClassNames = new Set<string>();
  //   for (let clsName of attributeValue.attribute.allowedClases!) {
  //     let schemaClass: SchemaClass = this.dataService.getSchemaClass(clsName)!;
  //     this.grepConcreteClasses(schemaClass, concreteClassNames);
  //   }
  //   this.candidateClasses = [...concreteClassNames];
  //   this.candidateClasses.sort();
  // }
  //
  // private grepConcreteClasses(schemaClass: SchemaClass, concreteClsNames: Set<String>): void {
  //   if (!schemaClass.abstract)
  //     concreteClsNames.add(schemaClass.name);
  //   if (schemaClass.children) {
  //     for (let child of schemaClass.children) {
  //       this.grepConcreteClasses(child, concreteClsNames)
  //     }
  //   }
  // }
}
