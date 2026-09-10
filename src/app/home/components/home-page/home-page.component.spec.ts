import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';

import { PageTitleService } from 'src/app/core/services/page-title.service';
import { componentTestImports } from 'src/testing';
import { HomePageComponent } from './home-page.component';

describe('HomePageComponent', () => {
  let component: HomePageComponent;
  let fixture: ComponentFixture<HomePageComponent>;
  let pageTitle: jasmine.SpyObj<PageTitleService>;

  beforeEach(async () => {
    pageTitle = jasmine.createSpyObj<PageTitleService>('PageTitleService', ['setTitle']);

    await TestBed.configureTestingModule({
      imports: [...componentTestImports(), ReactiveFormsModule],
      declarations: [HomePageComponent],
      providers: [{ provide: PageTitleService, useValue: pageTitle }],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(HomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sets the browser page title to Home', () => {
    expect(pageTitle.setTitle).toHaveBeenCalledWith('Home');
  });

  it('offers every option before anything is typed', () => {
    const seen: string[][] = [];
    component.filteredOptions!.subscribe(options => seen.push(options));

    expect(seen[seen.length - 1]).toEqual(component.options);
  });

  it('filters the options as the search box is typed into', () => {
    let options: string[] = [];
    component.filteredOptions!.subscribe(o => (options = o));

    component.myControl.setValue('t');

    expect(options).toEqual(['Two', 'Three']);
  });

  it('filters case-insensitively', () => {
    let options: string[] = [];
    component.filteredOptions!.subscribe(o => (options = o));

    component.myControl.setValue('ONE');

    expect(options).toEqual(['One']);
  });

  it('yields no options for a term that matches nothing', () => {
    let options: string[] = [];
    component.filteredOptions!.subscribe(o => (options = o));

    component.myControl.setValue('zzz');

    expect(options).toEqual([]);
  });

  it('emits the requested view when switching views', () => {
    const emitted: string[] = [];
    component.viewChangeEvent.subscribe(view => emitted.push(view));

    component.switch_view('schema_view');

    expect(emitted).toEqual(['schema_view']);
  });
});
