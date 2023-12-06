import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompareUpdatedInstanceComponent } from './compare-updated-instance.component';

describe('CompareUpdatedInstanceComponent', () => {
  let component: CompareUpdatedInstanceComponent;
  let fixture: ComponentFixture<CompareUpdatedInstanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CompareUpdatedInstanceComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompareUpdatedInstanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
