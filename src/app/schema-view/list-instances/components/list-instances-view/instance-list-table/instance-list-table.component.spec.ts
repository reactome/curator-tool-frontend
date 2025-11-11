import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstanceListTableComponent } from './instance-list-table.component';

describe('ShellInstanceTableComponent', () => {
  let component: InstanceListTableComponent;
  let fixture: ComponentFixture<InstanceListTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstanceListTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstanceListTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
