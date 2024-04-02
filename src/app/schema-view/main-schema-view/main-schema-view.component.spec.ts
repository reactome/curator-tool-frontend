import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainSchemaViewComponent } from './main-schema-view.component';

describe('MainComponent', () => {
  let component: MainSchemaViewComponent;
  let fixture: ComponentFixture<MainSchemaViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MainSchemaViewComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainSchemaViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
