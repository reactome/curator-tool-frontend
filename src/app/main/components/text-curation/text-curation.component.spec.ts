import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextCurationComponent } from './text-curation.component';

describe('TextCurationComponent', () => {
  let component: TextCurationComponent;
  let fixture: ComponentFixture<TextCurationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextCurationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TextCurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
