import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventSideNavigationComponent } from './side-navigation.component';

describe('EventSideNavigationComponent', () => {
  let component: EventSideNavigationComponent;
  let fixture: ComponentFixture<EventSideNavigationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EventSideNavigationComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventSideNavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
