import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchemaClassTableComponent } from './schema-class-table.component';

describe('AttributeTableComponent', () => {
  let component: SchemaClassTableComponent;
  let fixture: ComponentFixture<SchemaClassTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchemaClassTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchemaClassTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
