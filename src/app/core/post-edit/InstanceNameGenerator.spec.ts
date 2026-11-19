import { Instance } from '../models/reactome-instance.model';
import { DataService } from '../services/data.service';
import { InstanceUtilities } from '../services/instance.service';
import { InstanceNameGenerator } from './InstanceNameGenerator';

describe('InstanceNameGenerator Publication names', () => {
  let generator: InstanceNameGenerator;

  const person = (dbId: number, displayName: string | undefined, atts: [string, any][] = []): Instance =>
    ({ dbId, displayName, schemaClassName: 'Person', attributes: new Map(atts) } as Instance);

  const publication = (atts: [string, any][]): Instance =>
    ({ dbId: 5629116, displayName: 'old', schemaClassName: 'LiteratureReference',
       attributes: new Map<string, any>([['year', 2013], ['title', 'Hedgehog signaling'], ...atts]) } as Instance);

  beforeEach(() => {
    const dataService = jasmine.createSpyObj<DataService>('DataService', ['getSchemaClass']);
    const utils = jasmine.createSpyObj<InstanceUtilities>('InstanceUtilities', ['isSchemaClass']);
    utils.isSchemaClass.and.callFake((_inst: Instance, cls: string) => cls === 'Publication');
    generator = new InstanceNameGenerator(dataService, utils);
  });

  it('uses authorName when it is set', () => {
    const pub = publication([['authorName', ['Desai, PB', 'Dean, B', 'Mitchell, DR']],
                             ['author', [person(1, 'Someone, X')]]]);
    expect(generator.generateDisplayName(pub)).toBe('Desai, PB et al. 2013. Hedgehog signaling');
  });

  it('falls back to the author Person instances when authorName is missing (e.g. 5629116)', () => {
    const pub = publication([['author', [person(5629053, 'Nozawa, YI'), person(5629032, 'Lin, C'),
                                         person(5358040, 'Chuang, PT')]]]);
    expect(generator.generateDisplayName(pub)).toBe('Nozawa, YI et al. 2013. Hedgehog signaling');
  });

  it('falls back to author when authorName holds only blanks', () => {
    const pub = publication([['authorName', ['  ']], ['author', [person(1, 'Nozawa, YI'), person(2, 'Lin, C')]]]);
    expect(generator.generateDisplayName(pub)).toBe('Nozawa, YI and Lin, C. 2013. Hedgehog signaling');
  });

  it('builds the name of a new Person that has no display name yet', () => {
    const pub = publication([['author', [person(-1, undefined, [['surname', 'Nozawa'], ['initial', 'YI']])]]]);
    expect(generator.generateDisplayName(pub)).toBe('Nozawa, YI. 2013. Hedgehog signaling');
  });

  it('still says unknown when neither slot has an author', () => {
    expect(generator.generateDisplayName(publication([]))).toBe('unknown. 2013. Hedgehog signaling');
  });
});
