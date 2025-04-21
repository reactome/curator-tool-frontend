import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneLlmComponentComponent } from './gene-llm-component.component';

describe('GeneLlmComponentComponent', () => {
  let component: GeneLlmComponentComponent;
  let fixture: ComponentFixture<GeneLlmComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GeneLlmComponentComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeneLlmComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
