import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbstractSummaryTableComponent } from './abstract-summary-table.component';

describe('AbstractSummaryTableComponent', () => {
  let component: AbstractSummaryTableComponent;
  let fixture: ComponentFixture<AbstractSummaryTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbstractSummaryTableComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AbstractSummaryTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
