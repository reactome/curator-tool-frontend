import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewInstanceDialogComponent } from './referrers-table.component';

describe('NewInstanceDialogComponent', () => {
  let component: NewInstanceDialogComponent;
  let fixture: ComponentFixture<NewInstanceDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NewInstanceDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewInstanceDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
