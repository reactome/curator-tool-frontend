import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Instance } from 'src/app/core/models/reactome-instance.model';
import { SchemaClass } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { ListViewLinkService } from './list-view-link.service';

describe('ListViewLinkService', () => {
  let service: ListViewLinkService;
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

  const instances = (...classNames: string[]) =>
    of({ instances: classNames.map((schemaClassName, i) => ({ dbId: i, schemaClassName } as Instance)), totalCount: classNames.length });

  beforeEach(() => {
    dataService = jasmine.createSpyObj<DataService>('DataService', ['fetchSchemaClassTree', 'searchInstances', 'getSchemaClass']);
    dataService.fetchSchemaClassTree.and.returnValue(of(root));
    dataService.getSchemaClass.and.callFake((name: string) =>
      name2class.get(name) ?? ({ name, children: [], abstract: false } as unknown as SchemaClass));
    TestBed.configureTestingModule({ providers: [{ provide: DataService, useValue: dataService }] });
    service = TestBed.inject(ListViewLinkService);
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

  it('looks the classes up with a dbId regex and lists the instances under their common class', () => {
    dataService.searchInstances.and.returnValue(instances('Reaction', 'BlackBoxEvent'));
    let url = '';

    service.listViewUrl([123, 456, 123]).subscribe(u => url = u);

    expect(dataService.searchInstances).toHaveBeenCalledWith('DatabaseObject', 0, 2, ['dbId'], ['Regex'], ['123|456']);
    expect(url).toBe('schema_view/list_instances/ReactionlikeEvent?attributes=dbId&operands=Regex&searchKeys=123%7C456');
  });
});
