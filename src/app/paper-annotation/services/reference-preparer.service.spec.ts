import { of, throwError } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { PaperInfo, ReactionRef, SessionUserInstances } from '../models/llm-api.models';
import { ReferencePreparer } from './reference-preparer.service';

describe('ReferencePreparer', () => {
  const PMID = '24751536';
  const lr = { dbId: -3, displayName: 'PMID:' + PMID, schemaClassName: 'LiteratureReference' };
  const shell = (dbId: number, schemaClassName: string, displayName = 'x') => ({ dbId, displayName, schemaClassName });

  // r0 (-5) and its summation cite the paper; r1 (-9) cites it too. The reference holds only its PubMed ID.
  const exported = (): SessionUserInstances => ({
    newInstances: [
      { dbId: -5, displayName: 'r0', schemaClassName: 'Reaction',
        attributes: { summation: [shell(-2, 'Summation')], literatureReference: [{ ...lr }], compartment: [shell(70101, 'Compartment')] } },
      { dbId: -2, displayName: 's', schemaClassName: 'Summation', attributes: { text: 't', literatureReference: [{ ...lr }] } },
      { dbId: -3, displayName: lr.displayName, schemaClassName: 'LiteratureReference', attributes: { pubMedIdentifier: Number(PMID) } },
      { dbId: -9, displayName: 'r1', schemaClassName: 'Reaction', attributes: { literatureReference: [{ ...lr }] } },
    ] as any, updatedInstances: [], deletedInstances: [], bookmarks: []
  });
  const reactions: ReactionRef[] = [{ key: 'r0', name: 'r0', dbId: -5, evidenceIds: [] }, { key: 'r1', name: 'r1', dbId: -9, evidenceIds: [] }];
  const paper: PaperInfo = { source: 'PMID:' + PMID, kind: 'pmid', pmid: PMID, name: PMID };
  const pdf = (name: string, pmid: string | null = null): PaperInfo => ({ source: name, kind: 'pdf', pmid, name });

  let data: jasmine.SpyObj<any>;
  let api: jasmine.SpyObj<any>;
  let preparer: ReferencePreparer;
  const pubmed = (attrs: Record<string, any>) => data.fillReference.and.callFake((i: Instance) =>
    of({ ...i, attributes: new Map([...(i.attributes as Map<string, any>), ...Object.entries(attrs)]) }));

  beforeEach(() => {
    data = jasmine.createSpyObj('DataService', ['searchInstances', 'fillReference', 'getSchemaClass']);
    api = jasmine.createSpyObj('LlmApiService', ['reaction']);
    api.reaction.and.returnValue(of({ evidence: [] }));
    pubmed({});
    // the display name of a LiteratureReference is the one for any Publication
    const utils = { isSchemaClass: (i: Instance, cls: string) => cls === 'Publication' && i.schemaClassName === 'LiteratureReference' };
    preparer = new ReferencePreparer(data, api, utils as any);
  });

  const run = (e = exported(), papers: PaperInfo[] = [paper], rs = reactions) => {
    let result: any;
    preparer.prepare(e, 's1', rs, papers).subscribe({ next: r => result = r, error: err => fail(err) });
    return result as { exported: SessionUserInstances; report: any };
  };
  const inst = (r: { exported: SessionUserInstances }, dbId: number) => (r.exported.newInstances as any[]).find(i => i.dbId === dbId);
  const citedBy = (r: { exported: SessionUserInstances }, dbId: number) =>
    (inst(r, dbId).attributes.literatureReference as any[]).map(x => x.dbId);

  it('fills a new reference from PubMed, with a proper name wherever it is cited, without searching Reactome', () => {
    pubmed({ title: 'PINK1 phosphorylates ubiquitin', journal: 'J Cell Biol', year: 2014, volume: 205, pages: '143-53',
             authorName: ['Kane LA', 'Lazarou M', 'Fogel AI'] });
    const r = run();
    const sent = data.fillReference.calls.mostRecent().args[0] as Instance;
    expect((sent.attributes as Map<string, any>).get('pubMedIdentifier')).toBe(Number(PMID));
    const ref = inst(r, -3);
    expect(ref.attributes).toEqual(jasmine.objectContaining(
      { pubMedIdentifier: Number(PMID), title: 'PINK1 phosphorylates ubiquitin', journal: 'J Cell Biol', year: 2014, volume: 205, pages: '143-53' }));
    expect(ref.displayName).toBe('Kane LA et al. 2014. PINK1 phosphorylates ubiquitin');
    expect(ref.attributes.displayName).toBe(ref.displayName);
    expect(inst(r, -5).attributes.literatureReference[0].displayName).toBe(ref.displayName);
    expect(r.report.filled).toEqual([PMID]);
    expect(data.searchInstances).not.toHaveBeenCalled();               // the annotation service already did that
  });

  it('loads a reference PubMed could not fill in as it came, and reports it', () => {
    data.fillReference.and.returnValue(throwError(() => new Error('PubMed down')));
    const r = run();
    expect(inst(r, -3).attributes).toEqual({ pubMedIdentifier: Number(PMID) });
    expect(citedBy(r, -5)).toEqual([-3]);
    expect(r.report.unfilled).toEqual([PMID]);
    data.fillReference.and.callFake((i: Instance) => of(i));                // nothing came back from PubMed
    expect(run().report.unfilled).toEqual([PMID]);
  });

  it('creates a reference named after a PDF without a PubMed ID, cited by every reaction when it is the only paper', () => {
    const e = exported();
    e.newInstances = (e.newInstances as any[]).map(i => ({ ...i, attributes: { ...i.attributes, literatureReference: undefined } }))
      .filter(i => i.dbId !== -3) as any;
    const r = run(e, [pdf('Smith lab notes.pdf')]);
    const made = (r.exported.newInstances as any[]).find(i => i.schemaClassName === 'LiteratureReference');
    expect(made.attributes.title).toBe('Smith lab notes');
    expect(made.dbId).toBeLessThan(-9);                                  // below every id in the export
    expect(citedBy(r, -5)).toEqual([made.dbId]);
    expect(citedBy(r, -2)).withContext('and its summation').toEqual([made.dbId]);
    expect(citedBy(r, -9)).toEqual([made.dbId]);
    expect(r.report.pdfs).toEqual(['Smith lab notes.pdf']);
    expect(api.reaction).not.toHaveBeenCalled();
  });

  it('with several papers, cites a PDF only from the reactions whose quotes come from it', () => {
    api.reaction.and.callFake((_: string, key: string) =>
      of({ evidence: key === 'r1' ? [{ source: 'notes.pdf' }, { source: 'PMID:' + PMID }] : [{ source: 'PMID:' + PMID }] }));
    const r = run(exported(), [paper, pdf('notes.pdf')]);
    const made = (r.exported.newInstances as any[]).find(i => i.schemaClassName === 'LiteratureReference' && i.attributes.title === 'notes');
    expect(citedBy(r, -9)).toContain(made.dbId);
    expect(citedBy(r, -5)).not.toContain(made.dbId);
    expect(r.report.pdfs).toEqual(['notes.pdf']);
  });

  it('does not create a reference for a PDF whose PubMed ID is known (the service cites it by that ID)', () => {
    const r = run(exported(), [pdf('24751536.pdf', PMID)]);
    expect(r.report.pdfs).toEqual([]);
    expect((r.exported.newInstances as any[]).filter(i => i.schemaClassName === 'LiteratureReference').length).toBe(1);
  });

  it('does not change the export it was given', () => {
    pubmed({ title: 'T', year: 2014, authorName: ['A'] });
    const e = exported();
    const before = JSON.stringify(e);
    run(e, [paper, pdf('notes.pdf')]);
    expect(JSON.stringify(e)).toBe(before);
  });

  it('leaves an existing reference, and other existing instances, alone', () => {
    const e = exported();
    e.newInstances = (e.newInstances as any[]).filter(i => i.dbId !== -3)
      .map(i => ({ ...i, attributes: { ...i.attributes, literatureReference: [shell(1234, 'LiteratureReference')] } })) as any;
    const r = run(e);
    expect(data.fillReference).not.toHaveBeenCalled();
    expect(citedBy(r, -5)).toEqual([1234]);
    expect(inst(r, -5).attributes.compartment).toEqual([shell(70101, 'Compartment')]);
  });
});
