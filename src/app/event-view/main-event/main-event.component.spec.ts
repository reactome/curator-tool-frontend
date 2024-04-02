import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainEventComponent } from './main-event.component';

describe('MainComponent', () => {
  let component: MainEventComponent;
  let fixture: ComponentFixture<MainEventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MainEventComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
