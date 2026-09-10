import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { componentTestImports, makeInstance } from 'src/testing';
import { SelectedInstancesTableComponent } from './selected-instances-table.component';

describe('SelectedInstancesTableComponent', () => {
  let component: SelectedInstancesTableComponent;
  let fixture: ComponentFixture<SelectedInstancesTableComponent>;

  const instances = [
    makeInstance({ dbId: 100, displayName: 'Glycolysis' }),
    makeInstance({ dbId: 101, displayName: 'A -> B', schemaClassName: 'Reaction' })
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [SelectedInstancesTableComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectedInstancesTableComponent);
    component = fixture.componentInstance;
  });

  it('starts empty and in selection mode', () => {
    expect(component.instances).toEqual([]);
    expect(component.isSelection).toBeTrue();
  });

  it('offers launch and remove on each row', () => {
    expect(component.actionButtons.map(b => b.name)).toEqual(['launch', 'close']);
  });

  it('feeds the bound instances into the Material table', () => {
    component.dataSource = instances;

    expect(component.matDataSource.data).toBe(component.instances);
    expect(component.matDataSource.data.map(i => i.dbId)).toEqual([100, 101]);
  });

  it('replaces the rows rather than accumulating them across bindings', () => {
    component.dataSource = instances;
    component.dataSource = [makeInstance({ dbId: 200 })];

    expect(component.matDataSource.data.map(i => i.dbId)).toEqual([200]);
  });

  it('clears the table when bound to an empty selection', () => {
    component.dataSource = instances;
    component.dataSource = [];

    expect(component.matDataSource.data).toEqual([]);
  });

  it('emits the instance the caller should remove', () => {
    // The parent owns the selection, so this table only reports the intent.
    const emitted: Instance[] = [];
    component.removeEvent.subscribe(i => emitted.push(i));

    component.removeInstance(instances[0]);

    expect(emitted).toEqual([instances[0]]);
  });

  it('opens an instance in a new tab from the launch action', () => {
    const open = spyOn(window, 'open');

    component.handleAction({ instance: instances[0], action: 'launch' });

    expect(open).toHaveBeenCalledWith('schema_view/instance/100', '_blank');
  });

  it('reports a removal from the close action', () => {
    const emitted: Instance[] = [];
    component.removeEvent.subscribe(i => emitted.push(i));

    component.handleAction({ instance: instances[1], action: 'close' });

    expect(emitted).toEqual([instances[1]]);
  });

  it('ignores an action it does not handle', () => {
    const open = spyOn(window, 'open');
    const emitted: Instance[] = [];
    component.removeEvent.subscribe(i => emitted.push(i));

    component.handleAction({ instance: instances[0], action: 'delete' });

    expect(open).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });
});
