import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferrersDialogComponent } from './referrers-dialog.component';

describe('ReferrersDialogComponent', () => {
  let component: ReferrersDialogComponent;
  let fixture: ComponentFixture<ReferrersDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ReferrersDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReferrersDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
