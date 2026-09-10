import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { AttributeValue, Instance } from 'src/app/core/models/reactome-instance.model';
import { DataService } from 'src/app/core/services/data.service';
import {
  commonTestProviders,
  componentTestImports,
  makeInstance,
  makeInstanceAttribute,
  makeSchemaClass,
  provideDialogContext
} from 'src/testing';
import { SelectInstanceDialogComponent } from './select-instance-dialog.component';

describe('SelectInstanceDialogComponent', () => {
  let component: SelectInstanceDialogComponent;
  let dialogRef: MatDialogRef<SelectInstanceDialogComponent>;
  let dataService: jasmine.SpyObj<DataService>;

  /**
   * A small class hierarchy for the allowed classes under test. `Publication` is abstract with
   * three concrete subclasses, one of which the dialog surfaces specially.
   */
  const CLASSES = {
    PhysicalEntity: makeSchemaClass('PhysicalEntity', {
      abstract: true,
      children: [
        makeSchemaClass('SimpleEntity'),
        makeSchemaClass('Complex'),
        makeSchemaClass('EntityWithAccessionedSequence')
      ]
    }),
    Publication: makeSchemaClass('Publication', {
      abstract: true,
      children: [
        makeSchemaClass('Book'),
        makeSchemaClass('LiteratureReference'),
        makeSchemaClass('URL')
      ]
    }),
    Species: makeSchemaClass('Species')
  } as Record<string, any>;

  function build(attributeValue: AttributeValue) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        SelectInstanceDialogComponent,
        ...provideDialogContext(attributeValue),
        { provide: MAT_DIALOG_DATA, useValue: attributeValue }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    dataService.getSchemaClass.and.callFake(
      (name: string) => CLASSES[name] ?? makeSchemaClass(name));
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(SelectInstanceDialogComponent);
    return component;
  }

  const slot = (name: string, allowed: string[], cardinality: '1' | '+' = '+'): AttributeValue => ({
    attribute: makeInstanceAttribute(name, allowed, { cardinality }),
    value: undefined
  });

  describe('candidate classes', () => {
    it('lists the allowed class ahead of its concrete subclasses', () => {
      build(slot('input', ['PhysicalEntity']));

      expect(component.candidateClasses).toEqual([
        'PhysicalEntity', 'Complex', 'EntityWithAccessionedSequence', 'SimpleEntity'
      ]);
    });

    it('sorts the concrete subclasses alphabetically', () => {
      build(slot('input', ['PhysicalEntity']));

      const group = component.candidateClassGroups[0];
      expect(group.concreteClasses)
        .toEqual([...group.concreteClasses].sort());
    });

    it('does not list the allowed class twice when it is concrete', () => {
      build(slot('species', ['Species']));

      expect(component.candidateClasses).toEqual(['Species']);
    });

    it('surfaces LiteratureReference ahead of the Publication group', () => {
      // It is by far the most commonly picked one, so it goes above the header rather than
      // being buried in the alphabetical list.
      build(slot('literatureReference', ['Publication']));

      expect(component.candidateClasses[0]).toEqual('LiteratureReference');
      expect(component.candidateClassGroups[0].leadingClasses).toEqual(['LiteratureReference']);
      expect(component.candidateClassGroups[0].concreteClasses).toEqual(['Book', 'URL']);
    });

    it('groups each allowed class separately for a slot that permits several', () => {
      build(slot('anything', ['PhysicalEntity', 'Species']));

      expect(component.candidateClassGroups.map(g => g.allowedClass))
        .toEqual(['PhysicalEntity', 'Species']);
    });

    it('opens on the first candidate class', () => {
      build(slot('literatureReference', ['Publication']));

      expect(component.selected).toEqual('LiteratureReference');
    });
  });

  describe('selecting instances', () => {
    const atp = makeInstance({ dbId: 203, displayName: 'ATP', schemaClassName: 'SimpleEntity' });
    const adp = makeInstance({ dbId: 204, displayName: 'ADP', schemaClassName: 'SimpleEntity' });

    it('keeps only the last row for a single-valued slot', () => {
      build(slot('referenceEntity', ['PhysicalEntity'], '1'));

      component.onSelectRow(atp);
      component.onSelectRow(adp);

      expect(component.selectedInstances).toEqual([adp]);
    });

    it('accumulates rows for a multi-valued slot', () => {
      build(slot('regulator', ['PhysicalEntity']));

      component.onSelectRow(atp);
      component.onSelectRow(adp);

      expect(component.selectedInstances).toEqual([atp, adp]);
    });

    it('drops a repeat pick on an ordinary multi-valued slot', () => {
      build(slot('regulator', ['PhysicalEntity']));

      component.onSelectRow(atp);
      component.onSelectRow(atp);

      expect(component.selectedInstances).toEqual([atp]);
    });

    it('keeps a repeat pick on a stoichiometry slot', () => {
      // input/output/hasComponent/repeatedUnit may legitimately hold the same instance
      // several times -- two ATP as input, for example.
      build(slot('input', ['PhysicalEntity']));

      component.onSelectRow(atp);
      component.onSelectRow(atp);

      expect(component.selectedInstances).toEqual([atp, atp]);
    });

    it('recognises every stoichiometry relationship type', () => {
      for (const name of ['input', 'output', 'hasComponent', 'repeatedUnit']) {
        build(slot(name, ['PhysicalEntity']));
        expect(component.allowsDuplicates).withContext(name).toBeTrue();
      }
    });

    it('does not allow duplicates on a non-stoichiometry slot', () => {
      build(slot('regulator', ['PhysicalEntity']));

      expect(component.allowsDuplicates).toBeFalse();
    });

    it('removes one occurrence at a time from a stoichiometry slot', () => {
      build(slot('input', ['PhysicalEntity']));
      component.onSelectRow(atp);
      component.onSelectRow(atp);

      component.onRemoveEvent(atp);

      expect(component.selectedInstances).toEqual([atp]);
    });

    it('hands the table a fresh array after a removal', () => {
      build(slot('input', ['PhysicalEntity']));
      component.onSelectRow(atp);
      const before = component.selectedInstances;

      component.onRemoveEvent(atp);

      expect(component.selectedInstances).not.toBe(before);
    });
  });

  it('reports the slot as single-valued from its cardinality', () => {
    expect(build(slot('referenceEntity', ['PhysicalEntity'], '1')).isSingleValued).toBeTrue();
    expect(build(slot('input', ['PhysicalEntity'], '+')).isSingleValued).toBeFalse();
  });

  it('offers launch and show-referrers on each candidate row', () => {
    build(slot('input', ['PhysicalEntity']));

    expect(component.actionButtons.map(b => b.name)).toEqual(['launch', 'list_alt']);
  });

  it('closes with the selection on OK', () => {
    build(slot('input', ['PhysicalEntity']));
    const atp = makeInstance({ dbId: 203 });
    component.onSelectRow(atp);

    component.onOK();

    expect(dialogRef.close).toHaveBeenCalledWith([atp]);
  });

  it('closes with nothing when cancelled', () => {
    build(slot('input', ['PhysicalEntity']));
    component.onSelectRow(makeInstance({ dbId: 203 }));

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
