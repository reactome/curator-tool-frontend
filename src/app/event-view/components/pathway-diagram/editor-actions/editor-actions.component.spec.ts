import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorActionsComponent } from './editor-actions.component';

describe('EditorActionsComponent', () => {
  let component: EditorActionsComponent;
  let fixture: ComponentFixture<EditorActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorActionsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EditorActionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
