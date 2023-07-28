import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RowElementComponent } from './row-element.component';

describe('RowElementComponent', () => {
  let component: RowElementComponent;
  let fixture: ComponentFixture<RowElementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RowElementComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RowElementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
