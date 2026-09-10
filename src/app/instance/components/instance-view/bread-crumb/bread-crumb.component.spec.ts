import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { componentTestImports, makeInstance } from 'src/testing';
import { BreadCrumbComponent } from './bread-crumb.component';

describe('BreadCrumbComponent', () => {
  let component: BreadCrumbComponent;
  let fixture: ComponentFixture<BreadCrumbComponent>;

  /** A three-deep trail: pathway -> reaction -> entity. */
  function trail(): Instance[] {
    return [
      makeInstance({ dbId: 100, displayName: 'Glycolysis' }),
      makeInstance({ dbId: 101, displayName: 'A -> B', schemaClassName: 'Reaction' }),
      makeInstance({ dbId: 201, displayName: 'glucose', schemaClassName: 'SimpleEntity' })
    ];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [BreadCrumbComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(BreadCrumbComponent);
    component = fixture.componentInstance;
  });

  it('starts with an empty trail', () => {
    expect(component.viewHistory).toEqual([]);
  });

  it('emits the instance at the clicked position', () => {
    component.viewHistory = trail();
    const emitted: Instance[] = [];
    component.clickEvent.subscribe(i => emitted.push(i));

    component.breadCrumb(null, 1);

    expect(emitted.length).toEqual(1);
    expect(emitted[0].dbId).toEqual(101);
  });

  it('drops everything after the clicked crumb, so the trail matches the view', () => {
    component.viewHistory = trail();

    component.breadCrumb(null, 1);

    expect(component.viewHistory.map(i => i.dbId)).toEqual([100, 101]);
  });

  it('leaves the trail alone when the last crumb is clicked', () => {
    component.viewHistory = trail();

    component.breadCrumb(null, 2);

    expect(component.viewHistory.map(i => i.dbId)).toEqual([100, 101, 201]);
  });

  it('collapses back to a single crumb when the root is clicked', () => {
    component.viewHistory = trail();

    component.breadCrumb(null, 0);

    expect(component.viewHistory.map(i => i.dbId)).toEqual([100]);
    expect(component.viewHistory.length).toEqual(1);
  });

  it('emits before truncating, so the handler sees the instance it asked for', () => {
    component.viewHistory = trail();
    let seen: Instance | undefined;
    component.clickEvent.subscribe(i => (seen = i));

    component.breadCrumb(null, 0);

    expect(seen!.dbId).toEqual(100);
  });
});
