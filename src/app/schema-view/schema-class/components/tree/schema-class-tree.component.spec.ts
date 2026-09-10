import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { Data_testService } from 'src/app/core/services/data_test.service';
import { NewInstanceActions } from 'src/app/instance/state/instance.actions';
import {
  InstanceUtilitiesSpy,
  StoreSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  flattenSchemaTree,
  makeInstance,
  makeNewInstance,
  makeSchemaClassTree
} from 'src/testing';
import { SchemaClassTreeComponent } from './schema-class-tree.component';

describe('SchemaClassTreeComponent', () => {
  let component: SchemaClassTreeComponent;
  let dataService: jasmine.SpyObj<DataService>;
  let utils: InstanceUtilitiesSpy;
  let store: StoreSpy;
  let router: any;
  let dataTest: jasmine.SpyObj<Data_testService>;

  beforeEach(() => {
    utils = createInstanceUtilitiesSpy();
    dataTest = jasmine.createSpyObj<Data_testService>(
      'Data_testService', ['createAndCommitAllConcreteSchemaClasses']);

    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        SchemaClassTreeComponent,
        { provide: InstanceUtilities, useValue: utils },
        { provide: Data_testService, useValue: dataTest }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    store = TestBed.inject(Store) as unknown as StoreSpy;
    router = TestBed.inject(Router);
    component = TestBed.inject(SchemaClassTreeComponent);
  });

  afterEach(() => component.ngOnDestroy());

  it('loads the schema tree on init', () => {
    component.ngOnInit();

    expect(dataService.fetchSchemaClassTree).toHaveBeenCalled();
  });

  it('roots the flattened tree at DatabaseObject', () => {
    component.ngOnInit();

    expect(component.treeControl.dataNodes[0].name).toEqual('DatabaseObject');
  });

  it('marks a class with subclasses as expandable', () => {
    component.ngOnInit();
    const byName = new Map(component.treeControl.dataNodes.map(n => [n.name, n]));

    expect(byName.get('Event')!.expandable).toBeTrue();
    expect(byName.get('Reaction')!.expandable).toBeFalse();
  });

  it('carries the abstract flag through, so abstract classes can be styled apart', () => {
    component.ngOnInit();
    const byName = new Map(component.treeControl.dataNodes.map(n => [n.name, n]));

    expect(byName.get('Event')!.abstract).toBeTrue();
    expect(byName.get('Pathway')!.abstract).toBeFalse();
  });

  it('nests each class one level below its parent', () => {
    component.ngOnInit();
    const byName = new Map(component.treeControl.dataNodes.map(n => [n.name, n]));

    expect(byName.get('DatabaseObject')!.level).toEqual(0);
    expect(byName.get('Event')!.level).toEqual(1);
    expect(byName.get('Pathway')!.level).toEqual(2);
  });

  it('expands the whole tree on the first load', () => {
    component.ngOnInit();

    expect(component.treeControl.expansionModel.selected.length).toBeGreaterThan(0);
  });

  it('keeps a curator-collapsed branch collapsed across a reload', () => {
    component.ngOnInit();
    component.treeControl.collapseAll();
    const event = component.treeControl.dataNodes.find(n => n.name === 'Event')!;
    component.treeControl.expand(event);

    // A reload replaces every node object, so expansion (keyed by object identity) has to
    // be restored by name or the tree springs fully open again on every store change.
    utils.subjects.committedNewInstDbId.next([-1, 500]);

    const expanded = component.treeControl.expansionModel.selected.map(n => n.name);
    expect(expanded).toContain('Event');
    expect(expanded).not.toContain('PhysicalEntity');
  });

  it('reloads the tree when a new instance is committed', () => {
    component.ngOnInit();
    dataService.fetchSchemaClassTree.calls.reset();

    utils.subjects.committedNewInstDbId.next([-1, 500]);

    expect(dataService.fetchSchemaClassTree).toHaveBeenCalledWith(true);
  });

  it('bypasses the cache when reloading after a commit, so the counts are fresh', () => {
    component.ngOnInit();
    dataService.fetchSchemaClassTree.calls.reset();

    utils.subjects.committedNewInstDbId.next([-1, 500]);

    expect(dataService.fetchSchemaClassTree.calls.mostRecent().args[0]).toBeTrue();
  });

  it('stops reloading once destroyed', () => {
    component.ngOnInit();
    component.ngOnDestroy();
    dataService.fetchSchemaClassTree.calls.reset();

    utils.subjects.committedNewInstDbId.next([-1, 500]);

    expect(dataService.fetchSchemaClassTree).not.toHaveBeenCalled();
  });

  describe('local instance counts', () => {
    /** Builds the component with `staged` coming back from every store selector. */
    function withStaged(staged: any[]) {
      store.setSelectResult(staged);
      component.ngOnInit();
      return new Map(component.treeControl.dataNodes.map(n => [n.name, n]));
    }

    it('counts a staged instance against its own class', () => {
      const byName = withStaged([makeNewInstance({ dbId: -1, schemaClassName: 'Pathway' })]);

      expect(byName.get('Pathway')!.localCount).toEqual(1);
    });

    it('rolls the count up through every ancestor class', () => {
      // The tree shows a count per class including descendants, so a staged Pathway has to
      // register against Event and DatabaseObject too.
      const byName = withStaged([makeNewInstance({ dbId: -1, schemaClassName: 'Pathway' })]);

      expect(byName.get('Event')!.localCount).toEqual(1);
      expect(byName.get('DatabaseObject')!.localCount).toEqual(1);
    });

    it('leaves sibling branches at zero', () => {
      const byName = withStaged([makeNewInstance({ dbId: -1, schemaClassName: 'Pathway' })]);

      expect(byName.get('PhysicalEntity')!.localCount).toEqual(0);
      expect(byName.get('Complex')!.localCount).toEqual(0);
    });

    it('counts an instance once even when it is in several staged buckets', () => {
      // The same instance can be both created and updated; every selector returns the same
      // list here, so a naive sum would count it three times.
      const byName = withStaged([makeInstance({ dbId: 100, schemaClassName: 'Pathway' })]);

      expect(byName.get('Pathway')!.localCount).toEqual(1);
    });

    it('ignores an instance whose class is not in the tree', () => {
      const byName = withStaged([
        makeNewInstance({ dbId: -1, schemaClassName: 'SomeClassNotInTheTree' })
      ]);

      expect(byName.get('DatabaseObject')!.localCount).toEqual(0);
    });

    it('reports the database count separately from the local one', () => {
      const byName = withStaged([]);

      expect(byName.get('Pathway')!.count).toEqual(210);
      expect(byName.get('Pathway')!.localCount).toEqual(0);
    });

    it('defaults a class with no database count to zero rather than undefined', () => {
      const tree = makeSchemaClassTree();
      flattenSchemaTree(tree).get('Pathway')!.count = undefined;
      dataService.fetchSchemaClassTree.and.returnValue(of(tree));

      const byName = withStaged([]);

      expect(byName.get('Pathway')!.count).toEqual(0);
    });
  });

  describe('creating an instance from the tree', () => {
    it('creates an instance of the clicked class', () => {
      component.createNewInstance('Pathway');

      expect(dataService.createNewInstance).toHaveBeenCalledWith('Pathway');
    });

    it('caches the new instance so the instance view can find it', () => {
      component.createNewInstance('Pathway');

      expect(dataService.registerInstance).toHaveBeenCalled();
    });

    it('stages a shell of it in the store', () => {
      const shell = { dbId: -1, displayName: 'To be generated', schemaClassName: 'Pathway' };
      utils.makeShell.and.returnValue(shell as any);

      component.createNewInstance('Pathway');

      expect(store.lastAction()!.type).toEqual(NewInstanceActions.register_new_instance.type);
    });

    it('navigates to the new instance so the curator can start editing', () => {
      dataService.createNewInstance.and.returnValue(
        of(makeNewInstance({ dbId: -7, schemaClassName: 'Pathway' })));

      component.createNewInstance('Pathway');

      expect(router.navigate).toHaveBeenCalledWith(['/schema_view/instance/-7']);
    });
  });

  it('runs the all-classes commit harness on request', () => {
    component.testAllSchemaClasses();

    expect(dataTest.createAndCommitAllConcreteSchemaClasses).toHaveBeenCalled();
  });
});
