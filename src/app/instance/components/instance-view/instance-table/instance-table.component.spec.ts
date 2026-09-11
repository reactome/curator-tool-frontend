// See also instance-table-scroll-to-attribute.spec.ts for the scroll behaviour and
// instance-table-comparison.model.spec.ts for the data source. This spec covers the table's
// own state: column layout, category filtering, sorting, and stoichiometry grouping.
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { AttributeValue, EDIT_ACTION, Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeEditService } from 'src/app/core/services/attribute-edit.service';
import { DataService } from 'src/app/core/services/data.service';
import {
  AttributeCategory,
  AttributeDataType,
  STOICHIOMETRY_RELATIONSHIP_TYPES
} from 'src/app/core/models/reactome-schema.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { NewInstanceDialogService } from '../../new-instance-dialog/new-instance-dialog.service';
import { SelectInstanceDialogService } from 'src/app/schema-view/list-instances/components/select-instance-dialog/select-instance-dialog.service';
import { DragDropService } from 'src/app/schema-view/instance-bookmark/drag-drop.service';
import {
  InstanceUtilitiesSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  makeInstance,
  makeInstanceAttribute,
  makeSchemaClass
} from 'src/testing';
import { InstanceTableComponent } from './instance-table.component';

describe('InstanceTableComponent', () => {
  let component: InstanceTableComponent;
  let utils: InstanceUtilitiesSpy;

  /** A Pathway with a schema class, so the table has attribute rows to build. */
  function pathway(overrides: Partial<Instance> = {}): Instance {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis', ...overrides });
    instance.schemaClass = makeSchemaClass('Pathway', {
      attributes: [makeInstanceAttribute('hasEvent', ['Event'])]
    });
    return instance;
  }

  const atp = { dbId: 203, displayName: 'ATP', schemaClassName: 'SimpleEntity' };
  const adp = { dbId: 204, displayName: 'ADP', schemaClassName: 'SimpleEntity' };

  beforeEach(() => {
    utils = createInstanceUtilitiesSpy();

    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        InstanceTableComponent,
        DragDropService,
        { provide: InstanceUtilities, useValue: utils },
        {
          provide: NewInstanceDialogService,
          useValue: jasmine.createSpyObj('NewInstanceDialogService', ['openDialog'])
        },
        {
          provide: SelectInstanceDialogService,
          useValue: jasmine.createSpyObj('SelectInstanceDialogService', ['openDialog'])
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    component = TestBed.inject(InstanceTableComponent);
  });

  afterEach(() => component.ngOnDestroy());

  describe('columns', () => {
    it('shows the attribute name and its value', () => {
      expect(component.displayedColumns).toEqual(['name', 'value']);
    });

    it('adds a reference column when a comparison instance is bound', () => {
      component.instance = pathway();

      component.setReferenceInstance(makeInstance({ dbId: 101, displayName: 'Other' }));

      expect(component.showReferenceColumn).toBeTrue();
      expect(component.displayedColumns).toEqual(['name', 'value', 'referenceValue']);
    });

    it('labels the column "Database Value" when comparing against the same instance', () => {
      // Same dbId means this is the staged-vs-database comparison, not two instances.
      component.instance = pathway();

      component.setReferenceInstance(makeInstance({ dbId: 100, displayName: 'Glycolysis' }));

      expect(component.referenceColumnTitle).toEqual('Database Value');
    });

    it('labels both columns by display name when comparing two instances', () => {
      component.instance = pathway();

      component.setReferenceInstance(makeInstance({ dbId: 101, displayName: 'Gluconeogenesis' }));

      expect(component.referenceColumnTitle).toEqual('Gluconeogenesis');
      expect(component.valueColumnTitle).toEqual('Glycolysis');
    });

    it('drops the reference column when the comparison is cleared', () => {
      component.instance = pathway();
      component.setReferenceInstance(makeInstance({ dbId: 101 }));

      component.setReferenceInstance(undefined);

      expect(component.showReferenceColumn).toBeFalse();
      expect(component.displayedColumns).toEqual(['name', 'value']);
    });
  });

  describe('the bound instance', () => {
    it('takes the instance it is given', () => {
      const instance = pathway();

      component.instance = instance;

      expect(component._instance).toBe(instance);
    });

    it('refuses an outside change while the curator is mid-edit', () => {
      // A refresh landing mid-edit would swap the instance under the open editor and lose
      // the value being typed.
      const original = pathway();
      component.instance = original;
      component.inEditing = true;

      component.instance = pathway({ dbId: 101 });

      expect(component._instance).toBe(original);
    });

    it('accepts changes again once the edit is finished', () => {
      component.instance = pathway();
      component.inEditing = true;
      component.inEditing = false;
      const next = pathway({ dbId: 101 });

      component.instance = next;

      expect(component._instance).toBe(next);
    });
  });

  describe('stable identifier', () => {
    it('reports one when the slot is filled', () => {
      component.instance = pathway({
        attributes: new Map([['stableIdentifier', { dbId: 500, displayName: 'R-HSA-100' }]])
      });

      expect(component.hasStableIdentifier()).toBeTrue();
    });

    it('reports none for an empty slot', () => {
      component.instance = pathway();

      expect(component.hasStableIdentifier()).toBeFalse();
    });

    it('reports none for an explicit null', () => {
      component.instance = pathway({
        attributes: new Map([['stableIdentifier', null]])
      });

      expect(component.hasStableIdentifier()).toBeFalse();
    });

    it('reports none with nothing bound', () => {
      expect(component.hasStableIdentifier()).toBeFalse();
    });
  });

  describe('attribute category filtering', () => {
    it('starts with every category shown', () => {
      for (const name of component.categoryNames) {
        const key = name as keyof typeof AttributeCategory;
        expect(component.categories.get(AttributeCategory[key])).withContext(name).toBeTrue();
      }
    });

    it('hides a category when it is unticked', () => {
      component.doFilter(AttributeCategory.OPTIONAL);

      expect(component.categories.get(AttributeCategory.OPTIONAL)).toBeFalse();
    });

    it('shows it again when re-ticked', () => {
      component.doFilter(AttributeCategory.OPTIONAL);

      component.doFilter(AttributeCategory.OPTIONAL);

      expect(component.categories.get(AttributeCategory.OPTIONAL)).toBeTrue();
    });

    it('leaves the other categories alone', () => {
      component.doFilter(AttributeCategory.OPTIONAL);

      expect(component.categories.get(AttributeCategory.MANDATORY)).toBeTrue();
    });
  });

  describe('sorting', () => {
    it('sorts by attribute name by default', () => {
      expect(component.sortAttNames).toBeTrue();
      expect(component.sortAttDefined).toBeFalse();
    });

    it('reverses the name sort on request', () => {
      component.sort();

      expect(component.sortAttNames).toBeFalse();
    });

    it('drops the defined-first sort when sorting by name', () => {
      // The two orderings are alternatives, so choosing one has to clear the other.
      component.sortByDefined();

      component.sort();

      expect(component.sortAttDefined).toBeFalse();
    });

    it('toggles the defined-first sort', () => {
      component.sortByDefined();
      expect(component.sortAttDefined).toBeTrue();

      component.sortByDefined();
      expect(component.sortAttDefined).toBeFalse();
    });
  });

  describe('stoichiometry attributes', () => {
    it('recognises the multi-valued instance slots that allow repeats', () => {
      for (const name of STOICHIOMETRY_RELATIONSHIP_TYPES) {
        const attribute = makeInstanceAttribute(name, ['PhysicalEntity']);
        expect(component.isStoichiometryAttribute(attribute)).withContext(name).toBeTrue();
      }
    });

    it('does not treat a single-valued instance slot as one', () => {
      expect(component.isStoichiometryAttribute(
        makeInstanceAttribute('input', ['PhysicalEntity'], { cardinality: '1' }))).toBeFalse();
    });

    it('does not treat a scalar slot as one', () => {
      expect(component.isStoichiometryAttribute(makeInstanceAttribute('input', [], {
        type: AttributeDataType.STRING
      }))).toBeFalse();
    });

    it('does not treat an ordinary instance slot as one', () => {
      expect(component.isStoichiometryAttribute(
        makeInstanceAttribute('regulator', ['PhysicalEntity']))).toBeFalse();
    });

    it('is false for no attribute at all', () => {
      expect(component.isStoichiometryAttribute(undefined)).toBeFalse();
    });
  });

  describe('collapsing repeated values into stoichiometry groups', () => {
    it('counts the copies of each instance', () => {
      const groups = component.getStoichiometryGroups([atp, adp, atp]);

      expect(groups.map(g => ({ dbId: g.value.dbId, count: g.count })))
        .toEqual([{ dbId: 203, count: 2 }, { dbId: 204, count: 1 }]);
    });

    it('anchors each group at the first copy in the underlying array', () => {
      // The index is what add/insert actions position against.
      const groups = component.getStoichiometryGroups([atp, adp, atp]);

      expect(groups.map(g => g.index)).toEqual([0, 1]);
    });

    it('keeps the actual copies, so a reorder can rebuild the flat array', () => {
      const groups = component.getStoichiometryGroups([atp, adp, atp]);

      expect(groups[0].items.length).toEqual(2);
      expect(groups[1].items.length).toEqual(1);
    });

    it('handles a single value that is not in an array', () => {
      const groups = component.getStoichiometryGroups(atp);

      expect(groups.length).toEqual(1);
      expect(groups[0].count).toEqual(1);
    });

    it('yields nothing for an empty slot', () => {
      expect(component.getStoichiometryGroups(undefined)).toEqual([]);
    });

    it('tracks a group by its dbId, so re-rendering does not remount the row', () => {
      expect(component.trackByGroupDbId(0, { value: atp })).toEqual(203);
    });

    it('falls back to the index for a group with no dbId', () => {
      expect(component.trackByGroupDbId(3, { value: undefined })).toEqual(3);
    });
  });

  describe('reordering stoichiometry groups', () => {
    /** The `input` slot of a reaction holding two ATP and one ADP. */
    function reactionWithInputs(): { instance: Instance, element: AttributeValue } {
      const attribute = makeInstanceAttribute('input', ['PhysicalEntity']);
      const instance = makeInstance({
        dbId: 101,
        schemaClassName: 'Reaction',
        attributes: new Map([['input', [atp, atp, adp]]])
      });
      instance.schemaClass = makeSchemaClass('Reaction', { attributes: [attribute] });
      component.instance = instance;
      return { instance, element: { attribute, value: instance.attributes.get('input') } };
    }

    const drop = (previousIndex: number, currentIndex: number) =>
      ({ previousIndex, currentIndex } as CdkDragDrop<any[]>);

    it('moves every copy of an instance together', () => {
      // Splitting the copies would silently change the reaction's stoichiometry.
      const { instance, element } = reactionWithInputs();

      component.dropStoichiometry(drop(0, 1), element);

      expect(instance.attributes.get('input').map((v: any) => v.dbId))
        .toEqual([204, 203, 203]);
    });

    it('preserves the total number of values', () => {
      const { instance, element } = reactionWithInputs();

      component.dropStoichiometry(drop(1, 0), element);

      expect(instance.attributes.get('input').length).toEqual(3);
    });

    it('does nothing when the group is dropped where it started', () => {
      const { instance, element } = reactionWithInputs();
      const before = instance.attributes.get('input');

      component.dropStoichiometry(drop(0, 0), element);

      expect(instance.attributes.get('input')).toBe(before);
    });
  });

  describe('refusing a circular reference', () => {
    // The check itself is covered in event-cycle-check.service.spec.ts; what is covered here is
    // the wiring, which is where it went wrong: the check used to consult the loaded event tree,
    // so an edit made from the schema view - where nothing has loaded it - skipped the
    // containment test and a pathway was committed inside itself on 2026-09-10. Establishing
    // containment now takes a lookup, so the edit is applied from a subscription; if these two
    // paths are ever made synchronous again, the edit lands before the answer arrives.
    const metabolism = { dbId: 10, displayName: 'Metabolism', schemaClassName: 'Pathway' };

    /** Glycolysis [100] sits under Metabolism [10], as the referrers endpoint reports it. */
    function glycolysisUnderMetabolism(): Instance {
      const dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
      dataService.getReferrers.and.returnValue(
        of([{ attributeName: 'hasEvent', referrers: [metabolism as Instance] }]));
      return pathway();
    }

    function addViaSelect(instance: Instance, selected: any) {
      const selectDialog = TestBed.inject(SelectInstanceDialogService) as jasmine.SpyObj<SelectInstanceDialogService>;
      selectDialog.openDialog.and.returnValue({ afterClosed: () => of([selected]) } as any);
      component.instance = instance;
      component.onInstanceAttributeEdit({
        attribute: makeInstanceAttribute('hasEvent', ['Event']),
        value: undefined,
        editAction: EDIT_ACTION.ADD_VIA_SELECT,
      });
    }

    it('leaves hasEvent alone when the selected event already contains this one', () => {
      const attributeEdit = TestBed.inject(AttributeEditService) as jasmine.SpyObj<AttributeEditService>;
      const dialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;

      addViaSelect(glycolysisUnderMetabolism(), metabolism);

      expect(attributeEdit.addInstanceViaSelect).not.toHaveBeenCalled();
      expect(dialog.open).toHaveBeenCalled();
      expect((dialog.open.calls.mostRecent().args[1]?.data as any).title).toBe('Circular Reference');
    });

    it('adds an event that does not contain this one', () => {
      const attributeEdit = TestBed.inject(AttributeEditService) as jasmine.SpyObj<AttributeEditService>;
      const disease = { dbId: 40, displayName: 'Disease', schemaClassName: 'Pathway' };

      addViaSelect(glycolysisUnderMetabolism(), disease);

      expect(attributeEdit.addInstanceViaSelect).toHaveBeenCalled();
    });
  });

  it('registers itself as a drop target for bookmarked instances', () => {
    const dragDrop = TestBed.inject(DragDropService);

    expect(dragDrop.dropLists).toContain('cdk-drop-list-instance-table');
  });

  it('starts with no drag in progress', () => {
    expect(component.dragDropStatus)
      .toEqual({ dragging: false, dropping: false, draggedInstance: undefined });
  });

  it('toggles the filter options panel', () => {
    expect(component.showFilterOptions).toBeFalse();

    component.changeShowFilterOptions();
    expect(component.showFilterOptions).toBeTrue();

    component.changeShowFilterOptions();
    expect(component.showFilterOptions).toBeFalse();
  });

  it('toggles the header actions', () => {
    component.changeShowHeaderActions();

    expect(component.showHeaderActions).toBeTrue();
  });

  it('tracks which instances are staged for deletion', () => {
    // The table greys out references to them rather than removing the rows.
    expect(component.deletedDBIds).toEqual([]);
  });
});
