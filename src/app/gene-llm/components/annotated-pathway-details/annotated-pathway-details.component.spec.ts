import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnotatedPathwayDetailsComponent } from './annotated-pathway-details.component';

describe('AnnotatedPathwayDetailsComponent', () => {
  let component: AnnotatedPathwayDetailsComponent;
  let fixture: ComponentFixture<AnnotatedPathwayDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotatedPathwayDetailsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AnnotatedPathwayDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
