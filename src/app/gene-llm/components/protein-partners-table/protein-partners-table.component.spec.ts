import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProteinPartnersTableComponent } from './protein-partners-table.component';

describe('AbstractSummaryTableComponent', () => {
  let component: ProteinPartnersTableComponent;
  let fixture: ComponentFixture<ProteinPartnersTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProteinPartnersTableComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProteinPartnersTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
