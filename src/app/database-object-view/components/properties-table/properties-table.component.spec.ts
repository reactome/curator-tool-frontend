import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertiesTableComponent } from './properties-table.component';

describe('EntriesTableComponent', () => {
  let component: PropertiesTableComponent;
  let fixture: ComponentFixture<PropertiesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PropertiesTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PropertiesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
