import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstanceTableRowElementComponent } from './instance-table-row-element.component';

describe('RowElementComponent', () => {
  let component: InstanceTableRowElementComponent;
  let fixture: ComponentFixture<InstanceTableRowElementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstanceTableRowElementComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstanceTableRowElementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
