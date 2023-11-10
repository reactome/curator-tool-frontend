import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedInstancesTableComponent } from './selected-instances-table.component';

describe('SelectedInstancesTableComponent', () => {
  let component: SelectedInstancesTableComponent;
  let fixture: ComponentFixture<SelectedInstancesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelectedInstancesTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectedInstancesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
