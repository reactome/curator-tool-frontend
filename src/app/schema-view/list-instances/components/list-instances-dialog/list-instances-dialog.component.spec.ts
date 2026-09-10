import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SchemaClass } from 'src/app/core/models/reactome-schema.model';
import {
  componentTestImports,
  flattenSchemaTree,
  makeInstance,
  makeSchemaClassTree,
  provideDialogContext
} from 'src/testing';
import { ListInstancesDialogComponent } from './list-instances-dialog.component';

describe('ListInstancesDialogComponent', () => {
  let component: ListInstancesDialogComponent;
  let dialogRef: MatDialogRef<any>;

  const byName = flattenSchemaTree(makeSchemaClassTree());

  function build(schemaClass: SchemaClass, title = 'Select an instance') {
    const data = { schemaClass, title };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ListInstancesDialogComponent,
        ...provideDialogContext(data),
        { provide: MAT_DIALOG_DATA, useValue: data }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    dialogRef = TestBed.inject(MatDialogRef);
    component = TestBed.inject(ListInstancesDialogComponent);
    return component;
  }

  it('opens on the class it was asked about', () => {
    build(byName.get('Pathway')!);

    expect(component.selected).toEqual('Pathway');
    expect(component.schemaClasses).toEqual('Pathway');
  });

  it('shows the title the caller supplied', () => {
    build(byName.get('Pathway')!, 'Pick a pathway');

    expect(component.title).toEqual('Pick a pathway');
  });

  it('offers the class itself plus every ancestor, so the search can be widened', () => {
    build(byName.get('Pathway')!);

    expect(component.candidateClasses).toEqual(['Pathway', 'Event', 'DatabaseObject']);
  });

  it('offers only the class itself when it has no parent', () => {
    build(byName.get('DatabaseObject')!);

    expect(component.candidateClasses).toEqual(['DatabaseObject']);
  });

  it('starts with nothing selected', () => {
    build(byName.get('Pathway')!);

    expect(component.selectedInstances).toEqual([]);
  });

  it('keeps only the most recently clicked row, since this dialog picks one instance', () => {
    build(byName.get('Pathway')!);
    const first = makeInstance({ dbId: 100 });
    const second = makeInstance({ dbId: 101 });

    component.onSelectRow(first);
    component.onSelectRow(second);

    expect(component.selectedInstances).toEqual([second]);
  });

  it('closes with the chosen instance on OK', () => {
    build(byName.get('Pathway')!);
    const chosen = makeInstance({ dbId: 100 });
    component.onSelectRow(chosen);

    component.onOK();

    expect(dialogRef.close).toHaveBeenCalledWith(chosen);
  });

  it('closes with undefined on OK when nothing was chosen', () => {
    build(byName.get('Pathway')!);

    component.onOK();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it('closes with nothing when cancelled', () => {
    build(byName.get('Pathway')!);
    component.onSelectRow(makeInstance({ dbId: 100 }));

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  it('drops a removed instance and hands the table a fresh array', () => {
    build(byName.get('Pathway')!);
    const chosen = makeInstance({ dbId: 100 });
    component.onSelectRow(chosen);
    const before = component.selectedInstances;

    component.onRemoveEvent(chosen);

    expect(component.selectedInstances).toEqual([]);
    expect(component.selectedInstances).not.toBe(before);
  });
});
