import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstanceViewComponent } from './instance-view.component';

describe('InstanceViewComponent', () => {
  let component: InstanceViewComponent;
  let fixture: ComponentFixture<InstanceViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstanceViewComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstanceViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
