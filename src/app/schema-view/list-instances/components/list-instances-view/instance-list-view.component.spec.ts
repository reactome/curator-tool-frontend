import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstanceListViewComponent } from './instance-list-view.component';

describe('ListInstancesComponent', () => {
  let component: InstanceListViewComponent;
  let fixture: ComponentFixture<InstanceListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstanceListViewComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstanceListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
