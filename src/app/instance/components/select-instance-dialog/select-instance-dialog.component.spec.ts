import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectInstanceDialogComponent } from './select-instance-dialog.component';

describe('SelectInstanceDialogComponent', () => {
  let component: SelectInstanceDialogComponent;
  let fixture: ComponentFixture<SelectInstanceDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelectInstanceDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectInstanceDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
