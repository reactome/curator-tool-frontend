import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchemaClassTreeComponent } from './schema-class-tree.component';

describe('SchemaPanelComponent', () => {
  let component: SchemaClassTreeComponent;
  let fixture: ComponentFixture<SchemaClassTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchemaClassTreeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchemaClassTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
