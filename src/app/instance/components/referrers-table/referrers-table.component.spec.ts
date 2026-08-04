import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferrersTableComponent } from './referrers-table.component';

describe('ReferrersTableComponent', () => {
  let component: ReferrersTableComponent;
  let fixture: ComponentFixture<ReferrersTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ReferrersTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReferrersTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
