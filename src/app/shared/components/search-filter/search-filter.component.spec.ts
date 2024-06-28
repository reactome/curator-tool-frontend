import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchInstanceComponent } from './search-filter.component';

describe('SearchFilterComponent', () => {
  let component: SearchInstanceComponent;
  let fixture: ComponentFixture<SearchInstanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchInstanceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchInstanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
