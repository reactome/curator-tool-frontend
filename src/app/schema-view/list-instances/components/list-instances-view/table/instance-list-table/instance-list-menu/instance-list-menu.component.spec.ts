import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstanceListMenuComponent } from './instance-list-menu.component';

describe('ToolTipComponent', () => {
  let component: InstanceListMenuComponent;
  let fixture: ComponentFixture<InstanceListMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstanceListMenuComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstanceListMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
