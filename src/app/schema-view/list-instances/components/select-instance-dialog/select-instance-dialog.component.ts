import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AttributeValue, Instance } from 'src/app/core/models/reactome-instance.model';
import { ACTION_BUTTONS, SchemaClass, STOICHIOMETRY_RELATIONSHIP_TYPES } from "../../../../core/models/reactome-schema.model";
import { ActionButton } from '../list-instances-view/instance-list-table/instance-list-table.component';
import { DataService } from 'src/app/core/services/data.service';

/**
 * A dialog component that is used to create a new Instance object.
 *
 * <b>Note</b>: It is just too complexity to use rxjs store to manage new instance creation.
 * Here, we will use the data service directly.
 */
@Component({
  selector: 'app-select-instance-dialog',
  templateUrl: './select-instance-dialog.component.html',
  styleUrls: ['./select-instance-dialog.component.scss']
})

export class SelectInstanceDialogComponent {


  selected: string = '';
  candidateClasses: string[] = [];
  // Grouped by allowed (candidate) class, each with its concrete classes sorted alphabetically.
  // leadingClasses are concrete classes surfaced ahead of the group header (e.g. LiteratureReference).
  candidateClassGroups: Array<{ allowedClass: string, leadingClasses: string[], concreteClasses: string[] }> = [];
  instance: Instance | undefined;
  selectedInstances: Instance[] = [];
  selectedPanelMaxHeight: string = '50vh';
  isSingleValued: boolean = false;
  attributeSchemaClass: string = '';
  // For input, output, and hasComponent the same instance may be added multiple
  // times (e.g. ATP with a stoichiometry > 1). This drives how many copies of a
  // selected instance are added to the attribute value.
  stoichiometry: number = 1;

  // Customized buttons
  actionButtons: Array<ActionButton> = [ACTION_BUTTONS.LAUNCH, ACTION_BUTTONS.LIST];
  
  // Using constructor to correctly initialize values
  constructor(@Inject(MAT_DIALOG_DATA) public attributeValue: AttributeValue,
    public dialogRef: MatDialogRef<SelectInstanceDialogComponent>,
    private dataService: DataService) {
    this.isSingleValued = this.attributeValue.attribute.cardinality === '1';
    this.attributeSchemaClass = this.attributeValue.attribute.name;
    this.setCandidateClasses(attributeValue);
    this.selected = this.candidateClasses[0];
  }

  // Stoichiometry relationship types (input, output, hasComponent, repeatedUnit)
  // may legitimately contain the same instance multiple times.
  get allowsDuplicates(): boolean {
    return STOICHIOMETRY_RELATIONSHIP_TYPES.includes(this.attributeSchemaClass);
  }

  onSelectRow(row: Instance) {
    if (this.isSingleValued) {
      // Only take one value if the cardinality is 1
      this.selectedInstances = [row];
    }
    // input, output, and hasComponent may have the same instance multiple times
    // (ex: ATP). Add it stoichiometry times based on the stoichiometry input.
    else if (this.allowsDuplicates) {
      const count = Math.max(1, Math.floor(this.stoichiometry) || 1);
      const copies = Array.from({ length: count }, () => row);
      this.selectedInstances = [...this.selectedInstances, ...copies];
    }
    else {
      this.selectedInstances = [...this.selectedInstances, row];
      let noDuplicates: Instance[] = [];
      this.selectedInstances.forEach(element => {
        if (!noDuplicates.includes(element)) {
          noDuplicates.push(element);
        }
      });
      this.selectedInstances = noDuplicates;
    }

    this.updatePanelHeights();
  }

  onSelectionChange(): void {
    console.log('selected' + this.selected)
  }

  onCancel() {
    this.dialogRef.close();
  }

  onOK() {
    this.dialogRef.close(this.selectedInstances);
  }

  onRemoveEvent(instance: Instance) {
    let index = this.selectedInstances.indexOf(instance);
    this.selectedInstances.splice(index, 1);
    this.selectedInstances = [...this.selectedInstances];
    this.updatePanelHeights();
  }

  private updatePanelHeights() {
    if (this.selectedInstances.length === 0) {
      // this.optionsPanelMaxHeight = `${this.panelHeightBudgetVh}vh`;
      this.selectedPanelMaxHeight = '50vh';
      return;
    }

    // const selectedHeight = Math.min(
    //   this.panelHalfVh,
    //   this.selectedBaseVh + (this.selectedInstances.length - 1) * this.selectedStepVh
    // );
    // const optionsHeight = Math.max(this.panelHalfVh, this.panelHeightBudgetVh - selectedHeight);

    // this.optionsPanelMaxHeight = `${optionsHeight}vh`;
    // this.selectedPanelMaxHeight = `${selectedHeight}vh`;
  }

  setCandidateClasses(attributeValue: AttributeValue) {
    // For each allowed (candidate) class, list its concrete classes in alphabetical order.
    this.candidateClassGroups = [];
    this.candidateClasses = [];
    for (let clsName of attributeValue.attribute.allowedClases!) {
      let schemaClass: SchemaClass = this.dataService.getSchemaClass(clsName)!;
      let concreteClassNames = new Set<string>();
      this.grepConcreteClasses(schemaClass, concreteClassNames);
      // The candidate class is shown as its own selectable option, so drop it
      // from the concrete list to avoid listing it twice.
      let concreteClasses = [...concreteClassNames].filter(name => name !== clsName).sort();
      // For Publication attributes, surface LiteratureReference ahead of the
      // Publication group header since it is the most commonly used one.
      let leadingClasses: string[] = [];
      if (clsName === 'Publication' && concreteClasses.includes('LiteratureReference')) {
        concreteClasses = concreteClasses.filter(name => name !== 'LiteratureReference');
        leadingClasses = ['LiteratureReference'];
      }
      this.candidateClassGroups.push({ allowedClass: clsName, leadingClasses, concreteClasses });
      this.candidateClasses.push(...leadingClasses, clsName, ...concreteClasses);
    }
  }

  private grepConcreteClasses(schemaClass: SchemaClass, concreteClsNames: Set<String>): void {
    if (!schemaClass.abstract)
      concreteClsNames.add(schemaClass.name);
    if (schemaClass.children) {
      for (let child of schemaClass.children) {
        this.grepConcreteClasses(child, concreteClsNames)
      }
    }
  }
}
