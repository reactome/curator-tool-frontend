import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';

import { DataService } from 'src/app/core/services/data.service';
import { PageTitleService } from 'src/app/core/services/page-title.service';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType
} from 'src/app/core/models/reactome-schema.model';
import {
  commonTestProviders,
  componentTestImports,
  makeAttribute,
  makeSchemaClass
} from 'src/testing';
import { SchemaClassTableComponent } from './schema-class-table.component';

describe('SchemaClassTableComponent', () => {
  let component: SchemaClassTableComponent;
  let dataService: jasmine.SpyObj<DataService>;
  let pageTitle: jasmine.SpyObj<PageTitleService>;
  /** Drives the route params, so a spec can navigate class -> class like the real router. */
  let params: Subject<any>;

  beforeEach(() => {
    params = new Subject();
    pageTitle = jasmine.createSpyObj<PageTitleService>('PageTitleService', ['setTitle']);

    TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      providers: [
        ...commonTestProviders(),
        SchemaClassTableComponent,
        { provide: PageTitleService, useValue: pageTitle },
        { provide: ActivatedRoute, useValue: { params: params.asObservable() } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    dataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
    component = TestBed.inject(SchemaClassTableComponent);
    component.ngOnInit();
  });

  it('shows the attribute columns curators browse a class by', () => {
    expect(component.displayedColumns)
      .toEqual(['name', 'cardinality', 'type', 'category', 'origin', 'definingType']);
  });

  it('takes the class name from the route', () => {
    params.next({ className: 'Pathway' });

    expect(component.className).toEqual('Pathway');
  });

  it('fetches the attributes of the routed class', () => {
    params.next({ className: 'Pathway' });

    expect(dataService.fetchSchemaClass).toHaveBeenCalledWith('Pathway');
  });

  it('sets the page title to the class being browsed', () => {
    params.next({ className: 'Pathway' });

    expect(pageTitle.setTitle).toHaveBeenCalledWith('Class: Pathway');
  });

  it('retitles when navigating from one class to another', () => {
    // ngOnInit only ever runs once, because the router reuses this component instance across
    // class/A -> class/B; only the params subscription re-fires. Doing this work outside the
    // subscription left the title stuck on the first class.
    params.next({ className: 'Pathway' });
    params.next({ className: 'Reaction' });

    expect(pageTitle.setTitle).toHaveBeenCalledWith('Class: Reaction');
    expect(component.className).toEqual('Reaction');
  });

  it('re-fetches the attributes on each navigation', () => {
    params.next({ className: 'Pathway' });
    params.next({ className: 'Reaction' });

    expect(dataService.fetchSchemaClass).toHaveBeenCalledWith('Pathway');
    expect(dataService.fetchSchemaClass).toHaveBeenCalledWith('Reaction');
  });

  it('sorts the attributes by name', () => {
    dataService.fetchSchemaClass.and.returnValue(of(makeSchemaClass('Pathway', {
      attributes: [
        makeAttribute('summation'),
        makeAttribute('definition'),
        makeAttribute('name'),
        makeAttribute('hasEvent')
      ]
    })));

    params.next({ className: 'Pathway' });

    expect(component.dataSource.data.map((a: any) => a.name))
      .toEqual(['definition', 'hasEvent', 'name', 'summation']);
  });

  it('leaves the attribute array on the cached schema class unsorted', () => {
    // The schema class is cached and shared, so sorting it in place would change what every
    // other view sees.
    const schemaClass = makeSchemaClass('Pathway', {
      attributes: [makeAttribute('summation'), makeAttribute('definition')]
    });
    dataService.fetchSchemaClass.and.returnValue(of(schemaClass));

    params.next({ className: 'Pathway' });

    expect(schemaClass.attributes!.map(a => a.name)).toEqual(['summation', 'definition']);
  });

  it('handles a class with no attributes', () => {
    dataService.fetchSchemaClass.and.returnValue(
      of(makeSchemaClass('DatabaseObject', { attributes: [] })));

    params.next({ className: 'DatabaseObject' });

    expect(component.dataSource.data).toEqual([]);
  });

  it('exposes the schema enums so the template can label the columns', () => {
    expect((component as any).AttributeCategory).toBe(AttributeCategory);
    expect((component as any).AttributeDataType).toBe(AttributeDataType);
    expect((component as any).AttributeDefiningType).toBe(AttributeDefiningType);
  });
});
