import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PredictedPathwayDetailsComponent } from './predicted-pathway-details.component';

describe('AnnotatedPathwayDetailsComponent', () => {
  let component: PredictedPathwayDetailsComponent;
  let fixture: ComponentFixture<PredictedPathwayDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictedPathwayDetailsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PredictedPathwayDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
