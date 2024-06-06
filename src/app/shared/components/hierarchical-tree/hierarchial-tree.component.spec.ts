import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HierarchialTreeComponent } from './hierarchial-tree.component';

describe('HierarchialTreeComponent', () => {
  let component: HierarchialTreeComponent;
  let fixture: ComponentFixture<HierarchialTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HierarchialTreeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HierarchialTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
