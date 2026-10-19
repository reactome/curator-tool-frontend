import { TestBed } from '@angular/core/testing';

import { SchemaClass } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { NLQueryResponse } from './nl-query.service';
import { ResultListingService } from './result-listing.service';

describe('ResultListingService', () => {
  let service: ResultListingService;
  let dataService: jasmine.SpyObj<DataService>;

  // DatabaseObject > Event > ReactionlikeEvent > {Reaction, BlackBoxEvent}; Event > Pathway;
  // DatabaseObject > PhysicalEntity > Complex
  const name2class = new Map<string, SchemaClass>();
  const cls = (name: string, parent?: SchemaClass): SchemaClass => {
    const c = { name, parent, children: [], abstract: false } as unknown as SchemaClass;
    name2class.set(name, c);
    return c;
  };
  const root = cls('DatabaseObject');
  const event = cls('Event', root);
  const rle = cls('ReactionlikeEvent', event);
  cls('Reaction', rle);
  cls('BlackBoxEvent', rle);
  cls('Pathway', event);
  cls('Complex', cls('PhysicalEntity', root));

  const response = (columns: string[], rows: Record<string, unknown>[]): NLQueryResponse =>
    ({ answer: '', queries: [], columns, rows, rows_truncated: false, model: null });

  beforeEach(() => {
    dataService = jasmine.createSpyObj<DataService>('DataService', ['getSchemaClass']);
    dataService.getSchemaClass.and.callFake((name: string) =>
      name2class.get(name) ?? ({ name, children: [], abstract: false } as unknown as SchemaClass));
    TestBed.configureTestingModule({ providers: [{ provide: DataService, useValue: dataService }] });
    service = TestBed.inject(ResultListingService);
  });

  it('finds the most specific class the instances share', () => {
    expect(service.commonAncestor(['Reaction'])).toBe('Reaction');
    expect(service.commonAncestor(['Reaction', 'Reaction'])).toBe('Reaction');
    expect(service.commonAncestor(['Reaction', 'BlackBoxEvent'])).toBe('ReactionlikeEvent');
    expect(service.commonAncestor(['Reaction', 'ReactionlikeEvent'])).toBe('ReactionlikeEvent');
    expect(service.commonAncestor(['Reaction', 'Pathway'])).toBe('Event');
    expect(service.commonAncestor(['Reaction', 'Complex'])).toBe('DatabaseObject');
  });

  it('falls back to DatabaseObject when nothing or an unknown class is found', () => {
    expect(service.commonAncestor([])).toBe('DatabaseObject');
    expect(service.commonAncestor(['Reaction', 'NoSuchClass'])).toBe('DatabaseObject');
  });

  it('builds the instances from the rows, pairing the dbId column with its displayName and schemaClass', () => {
    const r = response(['r.dbId', 'r.displayName', 'r.schemaClass', 'n'], [
      { 'r.dbId': 123, 'r.displayName': 'A', 'r.schemaClass': 'Reaction', n: 1 },
      { 'r.dbId': '456', 'r.displayName': 'B', 'r.schemaClass': 'BlackBoxEvent', n: 2 },
      { 'r.dbId': 123, 'r.displayName': 'A', 'r.schemaClass': 'Reaction', n: 3 },
      { 'r.dbId': null, 'r.displayName': 'C', 'r.schemaClass': 'Reaction', n: 4 },
    ]);

    expect(service.listing(r, 'r.dbId')).toEqual({
      className: 'ReactionlikeEvent',
      instances: [
        { dbId: 123, displayName: 'A', schemaClassName: 'Reaction' },
        { dbId: 456, displayName: 'B', schemaClassName: 'BlackBoxEvent' },
      ],
    });
  });

  it('keeps each dbId column to its own sibling columns', () => {
    const r = response(['dbId', 'displayName', 'schemaClass', 'catalyst_dbId', 'catalyst_displayName'], [
      { dbId: 1, displayName: 'R', schemaClass: 'Reaction', catalyst_dbId: 2, catalyst_displayName: 'Cat' },
    ]);

    expect(service.listing(r, 'dbId').instances).toEqual([{ dbId: 1, displayName: 'R', schemaClassName: 'Reaction' }]);
    expect(service.listing(r, 'catalyst_dbId')).toEqual({
      className: 'DatabaseObject',
      instances: [{ dbId: 2, displayName: 'Cat', schemaClassName: 'DatabaseObject' }],
    });
  });

  it('finds dbId columns and the dbId keys of nested maps, skipping any without a dbId', () => {
    const r = response(['r.dbId', 'n.dbId', 'total', 'sample', 'node'], [
      { 'r.dbId': 1, 'n.dbId': null, total: 2, sample: [{ dbId: 3, catalyst_dbId: 4 }, { stId: 'R-HSA-1' }],
        node: { dbId: 5, displayName: 'N', schemaClass: 'Pathway' } },
    ]);

    expect(service.sources(r)).toEqual(['r.dbId', 'sample.dbId', 'sample.catalyst_dbId', 'node.dbId']);
    expect(service.sources(response(['count'], [{ count: 3 }]))).toEqual([]);
  });

  it('builds the instances of a nested source from its maps, by their name and class aliases', () => {
    const r = response(['total', 'sample', 'node'], [
      { total: 2, sample: [{ dbId: 11, name: 'A', cls: 'Reaction' }, { dbId: 12, name: 'B', cls: 'BlackBoxEvent' }],
        node: { dbId: 5, displayName: 'N', schemaClass: 'Pathway' } },
      { total: 1, sample: [{ dbId: 11, name: 'A', cls: 'Reaction' }], node: null },
    ]);

    expect(service.listing(r, 'sample.dbId')).toEqual({
      className: 'ReactionlikeEvent',
      instances: [
        { dbId: 11, displayName: 'A', schemaClassName: 'Reaction' },
        { dbId: 12, displayName: 'B', schemaClassName: 'BlackBoxEvent' },
      ],
    });
    expect(service.listing(r, 'node.dbId').instances).toEqual([{ dbId: 5, displayName: 'N', schemaClassName: 'Pathway' }]);
  });
});
