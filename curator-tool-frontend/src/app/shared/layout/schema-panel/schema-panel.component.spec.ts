import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchemaPanelComponent } from './schema-panel.component';

describe('SchemaPanelComponent', () => {
  let component: SchemaPanelComponent;
  let fixture: ComponentFixture<SchemaPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchemaPanelComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchemaPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
