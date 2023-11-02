import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListInstancesViewComponent } from './list-instances-view.component';

describe('ListInstancesViewComponent', () => {
  let component: ListInstancesViewComponent;
  let fixture: ComponentFixture<ListInstancesViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ListInstancesViewComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListInstancesViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
