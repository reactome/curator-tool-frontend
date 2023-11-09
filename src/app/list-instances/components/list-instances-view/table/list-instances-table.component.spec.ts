import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListInstancesTableComponent } from './list-instances-table.component';

describe('ListInstancesComponent', () => {
  let component: ListInstancesTableComponent;
  let fixture: ComponentFixture<ListInstancesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ListInstancesTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListInstancesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
