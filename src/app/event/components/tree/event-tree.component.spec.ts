import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventTreeComponent } from './event-tree.component';

describe('SchemaPanelComponent', () => {
  let component: EventTreeComponent;
  let fixture: ComponentFixture<EventTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EventTreeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
