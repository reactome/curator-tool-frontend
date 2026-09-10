import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { Instance, SelectedInstancesList } from 'src/app/core/models/reactome-instance.model';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { BookmarkActions } from 'src/app/schema-view/instance-bookmark/state/bookmark.actions';
import {
  InstanceUtilitiesSpy,
  StoreSpy,
  commonTestProviders,
  componentTestImports,
  createInstanceUtilitiesSpy,
  makeInstance,
  provideRouterStub,
  provideStoreSpy
} from 'src/testing';
import { InstanceListTableComponent } from './instance-list-table.component';

describe('InstanceListTableComponent', () => {
  let component: InstanceListTableComponent;
  let store: StoreSpy;
  let utils: InstanceUtilitiesSpy;

  const pathway = makeInstance({ dbId: 100, displayName: 'Glycolysis' });
  const reaction = makeInstance({ dbId: 101, displayName: 'A -> B', schemaClassName: 'Reaction' });

  /** Builds the table. `staged` is what every store selector returns (deleted + updated). */
  function build(staged: Instance[] = [], url = '/schema_view/list_instances/Pathway') {
    utils = createInstanceUtilitiesSpy();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        InstanceListTableComponent,
        provideStoreSpy(staged),
        provideRouterStub(url),
        { provide: InstanceUtilities, useValue: utils }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    store = TestBed.inject(Store) as unknown as StoreSpy;
    component = TestBed.inject(InstanceListTableComponent);
    component.dataSource = [pathway, reaction];
    return component;
  }

  afterEach(() => component.ngOnDestroy());

  it('shows the dbId, display name, and actions', () => {
    build();

    expect(component.displayedColumns).toEqual(['dbId', 'displayName', 'actionButtons']);
  });

  it('defaults to the main instance list for its selection bookkeeping', () => {
    build();

    expect(component.selectedInstanceListName).toEqual(SelectedInstancesList.mainInstanceList);
  });

  describe('staged-edit highlighting', () => {
    it('marks a row whose instance is staged for deletion', () => {
      build([makeInstance({ dbId: 100 })]);
      component.ngOnInit();

      expect(component.isDeleted(pathway)).toBeTrue();
      expect(component.isDeleted(reaction)).toBeFalse();
    });

    it('marks a row whose instance has staged edits', () => {
      build([makeInstance({ dbId: 101 })]);
      component.ngOnInit();

      expect(component.isUpdated(reaction)).toBeTrue();
    });

    it('marks nothing before init has read the store', () => {
      build([makeInstance({ dbId: 100 })]);

      expect(component.isDeleted(pathway)).toBeFalse();
    });

    it('stops tracking the store once destroyed', () => {
      build([makeInstance({ dbId: 100 })]);
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('checkbox selection', () => {
    it('records the selection in the shared list when the parent owns no selection', () => {
      build();

      component.addCheckBox(pathway);

      expect(utils.addSelectedInstance)
        .toHaveBeenCalledWith(SelectedInstancesList.mainInstanceList, pathway);
    });

    it('reports up to the parent instead when the parent supplies the selection', () => {
      // With selectedInstances bound, the parent is the source of truth; writing to the
      // shared list as well would double-count the instance.
      build();
      component.selectedInstances = [];
      const emitted: Instance[] = [];
      component.checkedEvent.subscribe(i => emitted.push(i));

      component.addCheckBox(pathway);

      expect(utils.addSelectedInstance).not.toHaveBeenCalled();
      expect(emitted).toEqual([pathway]);
    });

    it('emits the checked instance either way', () => {
      build();
      const emitted: Instance[] = [];
      component.checkedEvent.subscribe(i => emitted.push(i));

      component.addCheckBox(pathway);

      expect(emitted).toEqual([pathway]);
    });

    it('clears the selection from the shared list on uncheck', () => {
      build();

      component.removeCheckBox(pathway);

      expect(utils.removeSelectedInstance)
        .toHaveBeenCalledWith(SelectedInstancesList.mainInstanceList, pathway);
    });

    it('reports the uncheck to the parent when the parent owns the selection', () => {
      build();
      component.selectedInstances = [pathway];
      const emitted: Instance[] = [];
      component.uncheckedEvent.subscribe(i => emitted.push(i));

      component.removeCheckBox(pathway);

      expect(utils.removeSelectedInstance).not.toHaveBeenCalled();
      expect(emitted).toEqual([pathway]);
    });

    it('reads the tick state from the parent selection by dbId', () => {
      // Compared by dbId, not identity: the parent's list holds shells, not the same objects.
      build();
      component.selectedInstances = [makeInstance({ dbId: 100 })];

      expect(component.isChecked(pathway)).toBeTrue();
      expect(component.isChecked(reaction)).toBeFalse();
    });

    it('reads the tick state from the shared list otherwise', () => {
      build();
      utils.isInstanceSelected.and.returnValue(true);

      expect(component.isChecked(pathway)).toBeTrue();
      expect(utils.isInstanceSelected)
        .toHaveBeenCalledWith(SelectedInstancesList.mainInstanceList, pathway);
    });

    it('ticks every visible row from the selectAll input', () => {
      build();

      component.selectAll = true;

      expect(component.checkedMap.get(100)).toBeTrue();
      expect(component.checkedMap.get(101)).toBeTrue();
    });

    it('unticks every visible row from the selectAll input', () => {
      build();
      component.selectAll = true;

      component.selectAll = false;

      expect(component.checkedMap.get(100)).toBeFalse();
    });
  });

  describe('row interaction', () => {
    it('emits the clicked row and remembers it as selected', () => {
      build();
      const emitted: Instance[] = [];
      component.selectionEvent.subscribe(i => emitted.push(i));

      component.onRowClick(pathway);

      expect(component.selected).toEqual(100);
      expect(emitted).toEqual([pathway]);
    });

    it('emits the action button that was clicked with its instance', () => {
      build();
      const emitted: { instance: Instance, action: string }[] = [];
      component.actionEvent.subscribe(e => emitted.push(e));

      component.click(pathway, 'delete');

      expect(emitted).toEqual([{ instance: pathway, action: 'delete' }]);
    });

    it('stops a name-link click bubbling up to the row handler', () => {
      // Otherwise clicking the link both navigates and re-selects the row.
      build();
      const event = new MouseEvent('click');
      const stopPropagation = spyOn(event, 'stopPropagation');

      component.onInstanceLinkClicked(pathway, event);

      expect(stopPropagation).toHaveBeenCalled();
    });

    it('records the clicked instance so other views can follow it', () => {
      build();

      component.onInstanceLinkClicked(pathway);

      expect(utils.setLastClickedDbId).toHaveBeenCalledWith(100);
    });

    it('emits the clicked instance for the parent to navigate', () => {
      build();
      const emitted: Instance[] = [];
      component.urlClickEvent.subscribe(i => emitted.push(i));

      component.onInstanceLinkClicked(pathway);

      expect(emitted).toEqual([pathway]);
    });

    it('bookmarks a shell of the instance rather than the whole thing', () => {
      build();
      utils.makeShell.and.returnValue({ dbId: 100, displayName: 'Glycolysis' } as any);

      component.addBookmark(pathway);

      expect(store.lastAction()!.type).toEqual(BookmarkActions.add_bookmark.type);
    });
  });

  describe('navigation URL', () => {
    it('keeps the curator inside the schema view', () => {
      build([], '/schema_view/list_instances/Pathway');

      component.setNavigationUrl(pathway);

      expect(component.routerNavigationUrl).toEqual('/schema_view/instance/100');
    });

    it('keeps the curator inside the event view', () => {
      // Navigating to /schema_view from the event view would drop the event tree they were
      // working in.
      build([], '/event_view/instance/100');

      component.setNavigationUrl(reaction);

      expect(component.routerNavigationUrl).toEqual('/event_view/instance/101');
    });

    it('falls back to the schema view from an unrecognised route', () => {
      build([], '/home');

      component.setNavigationUrl(pathway);

      expect(component.routerNavigationUrl).toEqual('/schema_view/instance/100');
    });
  });
});
