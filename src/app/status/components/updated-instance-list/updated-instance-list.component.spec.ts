import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdatedInstanceListComponent } from './updated-instance-list.component';

describe('UpdatedInstanceListComponent', () => {
  let component: UpdatedInstanceListComponent;
  let fixture: ComponentFixture<UpdatedInstanceListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UpdatedInstanceListComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdatedInstanceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
