import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstanceSelectionComponent } from './instance-selection.component';

describe('ListInstancesComponent', () => {
  let component: InstanceSelectionComponent;
  let fixture: ComponentFixture<InstanceSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstanceSelectionComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstanceSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
