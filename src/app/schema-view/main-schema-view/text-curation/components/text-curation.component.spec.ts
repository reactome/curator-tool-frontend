import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { AttributeDataType } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import {
  StoreSpy,
  commonTestProviders,
  componentTestImports,
  makeAttribute,
  makeInstance,
  makeInstanceAttribute,
  makeNewInstance,
  makeSchemaClass
} from 'src/testing';
import { TextCurationComponent } from './text-curation.component';

describe('TextCurationComponent', () => {
  let component: TextCurationComponent;
  let dataService: jasmine.SpyObj<DataService>;
  let store: StoreSpy;
  let router: any;
  let pageTitle: jasmine.SpyObj<PageTitleService>;
  /** Stands in for the instance view the component drives its edits through. */
  let instanceTable: { _instance: Instance | undefined, finishEdit: jasmine.Spy };

  /** A Pathway whose class defines the slots these tests edit. */
  function pathway(): Instance {
    const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });
    instance.schemaClass = makeSchemaClass('Pathway', {
      attributes: [
        makeAttribute('definition'),
        makeAttribute('name', { cardinality: '+' }),
        makeInstanceAttribute('hasEvent', ['Event']),
        makeAttribute('reviewStatus', {
          type: AttributeDataType.INSTANCE, cardinality: '1', allowedClases: ['ReviewStatus']
        })
      ]
    });
    return instance;
  }

  beforeEach(() => {
    pageTitle = jasmine.createSpyObj<PageTitleService>('PageTitleService', ['setTitle']);

    TestBed.configureTestingModule({
      // Standalone component, so it is imported rather than declared.
      imports: [...componentTestImports(), TextCurationComponent],
      providers: [
        ...commonTestProviders(),
        { provide: PageTitleService, useValue: pageTitle }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    store = TestBed.inject(Store) as unknown as StoreSpy;
    router = TestBed.inject(Router);
    component = TestBed.createComponent(TextCurationComponent).componentInstance;

    instanceTable = { _instance: pathway(), finishEdit: jasmine.createSpy('finishEdit') };
    component.instanceView = { instanceTable } as any;
  });

  describe('page title', () => {
    it('titles the page when used as the schema view', () => {
      component.ngOnInit();

      expect(pageTitle.setTitle).toHaveBeenCalledWith('Schema View');
    });

    it('leaves the title of the host page alone when embedded', () => {
      component.embedded = true;

      component.ngOnInit();

      expect(pageTitle.setTitle).not.toHaveBeenCalled();
    });
  });

  describe('creating an instance', () => {
    it('creates, caches, stages, and navigates to the new instance', () => {
      dataService.createNewInstance.and.returnValue(
        of(makeNewInstance({ dbId: -4, schemaClassName: 'Pathway' })));

      component.createNewInstance('Pathway');

      expect(dataService.createNewInstance).toHaveBeenCalledWith('Pathway');
      expect(dataService.registerInstance).toHaveBeenCalled();
      expect(store.lastAction()!.type).toEqual(NewInstanceActions.register_new_instance.type);
      expect(router.navigate).toHaveBeenCalledWith(['/schema_view/instance/-4']);
    });
  });

  describe('opening an instance', () => {
    it('navigates to the requested instance', () => {
      component.editInstance(100);

      expect(router.navigate).toHaveBeenCalledWith(['/schema_view/instance/100']);
    });

    it('does nothing without a dbId', () => {
      component.editInstance(undefined as any);

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('setting a scalar attribute', () => {
    it('sets a single-valued slot to the value directly', () => {
      component.setAttribute('definition', 'The conversion of glucose.');

      expect(instanceTable._instance!.attributes.get('definition'))
        .toEqual('The conversion of glucose.');
    });

    it('wraps a value for a multi-valued slot in a list', () => {
      component.setAttribute('name', 'Glycolysis');

      expect(instanceTable._instance!.attributes.get('name')).toEqual(['Glycolysis']);
    });

    it('replaces a multi-valued slot by default', () => {
      component.setAttribute('name', 'first');

      component.setAttribute('name', 'second');

      expect(instanceTable._instance!.attributes.get('name')).toEqual(['second']);
    });

    it('appends to a multi-valued slot when asked', () => {
      component.setAttribute('name', 'first');

      component.setAttribute('name', 'second', true);

      expect(instanceTable._instance!.attributes.get('name')).toEqual(['first', 'second']);
    });

    it('starts a new list when appending to an empty slot', () => {
      component.setAttribute('name', 'first', true);

      expect(instanceTable._instance!.attributes.get('name')).toEqual(['first']);
    });

    it('refreshes the table so the edit is validated and shown', () => {
      component.setAttribute('definition', 'x');

      expect(instanceTable.finishEdit).toHaveBeenCalledWith('definition', ['x']);
    });

    it('ignores an attribute not defined by the class of the instance', () => {
      // The model may hallucinate a slot name; writing it would corrupt the instance.
      component.setAttribute('notASlot', 'x');

      expect(instanceTable._instance!.attributes.has('notASlot')).toBeFalse();
      expect(instanceTable.finishEdit).not.toHaveBeenCalled();
    });

    it('does nothing when no instance is loaded', () => {
      instanceTable._instance = undefined;

      expect(() => component.setAttribute('definition', 'x')).not.toThrow();
      expect(instanceTable.finishEdit).not.toHaveBeenCalled();
    });

    it('does nothing when there is no instance table at all', () => {
      component.instanceView = { instanceTable: undefined } as any;

      expect(() => component.setAttribute('definition', 'x')).not.toThrow();
    });
  });

  describe('setting an instance-valued attribute', () => {
    it('resolves a numeric value as a dbId', () => {
      dataService.fetchInstance.and.returnValue(of(makeInstance({
        dbId: 9821383, displayName: 'three stars', schemaClassName: 'ReviewStatus'
      })));

      component.setAttribute('reviewStatus', 9821383);

      expect(dataService.fetchInstance).toHaveBeenCalledWith(9821383);
      expect(instanceTable._instance!.attributes.get('reviewStatus'))
        .toEqual({ dbId: 9821383, displayName: 'three stars', schemaClassName: 'ReviewStatus' });
    });

    it('resolves a string value as a display name, within the allowed classes', () => {
      dataService.findInstanceByDisplayName.and.returnValue(of(makeInstance({
        dbId: 9821383, displayName: 'three stars', schemaClassName: 'ReviewStatus'
      })) as any);

      component.setAttribute('reviewStatus', 'three stars');

      expect(dataService.findInstanceByDisplayName)
        .toHaveBeenCalledWith('three stars', ['ReviewStatus']);
    });

    it('stores only a shell of the resolved instance', () => {
      // Keeping the whole instance in the slot would duplicate it in the staged edits.
      const resolved = makeInstance({
        dbId: 101, displayName: 'A -> B', schemaClassName: 'Reaction',
        attributes: new Map([['input', ['heavy']]])
      });
      dataService.findInstanceByDisplayName.and.returnValue(of(resolved) as any);

      component.setAttribute('hasEvent', 'A -> B');

      expect(instanceTable._instance!.attributes.get('hasEvent'))
        .toEqual([{ dbId: 101, displayName: 'A -> B', schemaClassName: 'Reaction' }]);
    });

    it('appends to a multi-valued instance slot when asked', () => {
      const first = makeInstance({ dbId: 101, displayName: 'A -> B', schemaClassName: 'Reaction' });
      const second = makeInstance({ dbId: 102, displayName: 'B -> C', schemaClassName: 'Reaction' });
      dataService.findInstanceByDisplayName.and.returnValue(of(first) as any);
      component.setAttribute('hasEvent', 'A -> B');
      dataService.findInstanceByDisplayName.and.returnValue(of(second) as any);

      component.setAttribute('hasEvent', 'B -> C', true);

      expect(instanceTable._instance!.attributes.get('hasEvent').map((i: any) => i.dbId))
        .toEqual([101, 102]);
    });

    it('leaves the slot untouched when nothing matches the display name', () => {
      dataService.findInstanceByDisplayName.and.returnValue(of(undefined) as any);

      component.setAttribute('hasEvent', 'no such reaction');

      expect(instanceTable._instance!.attributes.has('hasEvent')).toBeFalse();
      expect(instanceTable.finishEdit).not.toHaveBeenCalled();
    });
  });

  it('declares an operation schema the model must fill in completely', () => {
    // Every field is required, so a partial tool call is rejected rather than half-applied.
    expect(component.operationSchema.required)
      .toEqual(['operation', 'schemaClassName', 'attribute', 'value', 'dbId']);
  });
});
