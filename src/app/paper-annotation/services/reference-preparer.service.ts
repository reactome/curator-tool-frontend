import { Injectable } from '@angular/core';
import { Observable, catchError, from, map, mergeMap, of, toArray } from 'rxjs';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { InstanceNameGenerator } from 'src/app/core/post-edit/InstanceNameGenerator';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceUtilities } from 'src/app/core/services/instance.service';
import { PaperInfo, ReactionDetail, ReactionRef, SessionUserInstances } from '../models/llm-api.models';
import { LlmApiService } from './llm-api.service';

/** What happened to the papers the loaded reactions cite, for the curator to read before loading. */
export interface ReferenceReport {
  /** PubMed IDs of the new references, filled in from PubMed. */
  filled: string[];
  /** PubMed IDs that could not be filled in (PubMed unreachable or had nothing); loaded with the PubMed ID only. */
  unfilled: string[];
  /** PDFs without a PubMed ID, each now cited by a new reference named after the file, for a curator to complete. */
  pdfs: string[];
}

type Ref = { dbId: number; displayName: string; schemaClassName: string };
type Raw = Ref & { attributes?: Record<string, any> };

/** How many PubMed look-ups run at once. */
const CONCURRENCY = 4;

const isRef = (v: unknown): v is Ref => !!v && typeof v === 'object' && typeof (v as Ref).dbId === 'number';

/**
 * Gets the cited papers of an annotation ready to load into staged instances. The service that drafts an annotation
 * already uses the LiteratureReference Reactome has for a cited PubMed ID, and creates a new one, holding only the
 * PubMed ID, when Reactome has none. So, at the time of loading:
 *  - each new reference is filled in from PubMed, as when a curator types a PubMed ID in Schema View;
 *  - a PDF without a PubMed ID, which the service cites with nothing, gets a reference named after the file.
 * Nothing here stops the load: a reference that could not be filled in is reported and loaded as it came.
 */
@Injectable({ providedIn: 'root' })
export class ReferencePreparer {
  private readonly names: InstanceNameGenerator;

  constructor(private data: DataService, private api: LlmApiService, utils: InstanceUtilities) {
    this.names = new InstanceNameGenerator(data, utils);
  }

  prepare(exported: SessionUserInstances, sessionId: string, reactions: ReactionRef[], papers: PaperInfo[]):
      Observable<{ exported: SessionUserInstances; report: ReferenceReport }> {
    // a copy: the export it came from shares unchanged instances with this one
    const out: SessionUserInstances = JSON.parse(JSON.stringify(exported));
    const report: ReferenceReport = { filled: [], unfilled: [], pdfs: [] };
    return this.citePdfs(out, sessionId, reactions, papers, report).pipe(
      mergeMap(() => this.fillPubMed(out, report)),
      map(() => ({ exported: out, report })));
  }

  // ── PDFs without a PubMed ID ─────────────────────────────────────────────

  private citePdfs(out: SessionUserInstances, sessionId: string, reactions: ReactionRef[], papers: PaperInfo[],
                   report: ReferenceReport): Observable<void> {
    const pdfs = papers.filter(p => p.kind === 'pdf' && !p.pmid);
    const loaded = reactions.filter(r => r.dbId !== null && raw(out).some(i => i.dbId === r.dbId));
    if (!pdfs.length || !loaded.length) return of(undefined);
    // With one paper, every reaction is from it; with several, a reaction's quotes say which papers it is from.
    const sourcesOf: Observable<{ reaction: ReactionRef; sources: Set<string> }[]> = papers.length === 1
      ? of(loaded.map(reaction => ({ reaction, sources: new Set([pdfs[0].source]) })))
      : from(loaded).pipe(
          mergeMap(reaction => this.api.reaction(sessionId, reaction.key).pipe(
            map((d: ReactionDetail) => ({ reaction, sources: new Set(d.evidence.map(e => e.source).filter((s): s is string => !!s)) })),
            catchError(() => of({ reaction, sources: new Set<string>() }))), CONCURRENCY),
          toArray());
    return sourcesOf.pipe(map(list => {
      let next = Math.min(0, ...raw(out).map(i => i.dbId)) - 1;
      for (const pdf of pdfs) {
        const citing = list.filter(x => x.sources.has(pdf.source)).map(x => x.reaction.dbId!);
        if (!citing.length) continue;
        const title = pdf.name.replace(/\.pdf$/i, '');
        const ref: Ref = { dbId: next--, displayName: title, schemaClassName: 'LiteratureReference' };
        raw(out).push({ ...ref, attributes: { dbId: ref.dbId, displayName: ref.displayName, title } });
        citing.forEach(id => this.cite(out, id, ref));
        report.pdfs.push(pdf.name);
      }
    }));
  }

  /** A reaction, and its summations, cite the reference (as the service cites a PubMed ID). */
  private cite(out: SessionUserInstances, reactionDbId: number, ref: Ref): void {
    const reaction = raw(out).find(i => i.dbId === reactionDbId);
    if (!reaction) return;
    const add = (i: Raw) => {
      i.attributes = i.attributes ?? {};
      const list: Ref[] = i.attributes['literatureReference'] ?? [];
      if (!list.some(x => x.dbId === ref.dbId)) i.attributes['literatureReference'] = [...list, { ...ref }];
    };
    add(reaction);
    const summations: Ref[] = reaction.attributes?.['summation'] ?? [];
    summations.forEach(s => { const i = raw(out).find(x => x.dbId === s.dbId); if (i) add(i); });
  }

  // ── PubMed IDs ───────────────────────────────────────────────────────────

  private fillPubMed(out: SessionUserInstances, report: ReferenceReport): Observable<void> {
    const fresh = raw(out).filter(i => i.dbId < 0 && i.schemaClassName === 'LiteratureReference' && pmidOf(i));
    if (!fresh.length) return of(undefined);
    return from(fresh).pipe(
      mergeMap(ref => this.fill(out, ref, pmidOf(ref)!, report)
        .pipe(catchError(() => { report.unfilled.push(pmidOf(ref)!); return of(undefined); })), CONCURRENCY),
      toArray(),
      map(() => undefined));
  }

  /** Fill a new reference from PubMed, through the same server call Schema View uses when a PubMed ID is typed. */
  private fill(out: SessionUserInstances, ref: Raw, pmid: string, report: ReferenceReport): Observable<void> {
    const instance: Instance = {
      dbId: ref.dbId, displayName: ref.displayName, schemaClassName: 'LiteratureReference',
      attributes: new Map<string, any>([['pubMedIdentifier', Number(pmid)]])
    };
    return this.data.fillReference(instance).pipe(map(filled => {
      const attrs = filled.attributes instanceof Map ? Object.fromEntries(filled.attributes) : (filled.attributes ?? {});
      if (!attrs['title']) { report.unfilled.push(pmid); return; }       // PubMed had nothing for it
      const displayName = this.names.generateDisplayName({ ...instance, attributes: new Map(Object.entries(attrs)) }) || ref.displayName;
      ref.attributes = { ...ref.attributes, ...attrs, dbId: ref.dbId, displayName };
      ref.displayName = displayName;
      rename(out, ref.dbId, displayName);
      report.filled.push(pmid);
    }));
  }
}

function raw(out: SessionUserInstances): Raw[] {
  return out.newInstances as unknown as Raw[];
}

function pmidOf(i: Raw): string | null {
  const v = i.attributes?.['pubMedIdentifier'];
  const one = Array.isArray(v) ? v[0] : v;
  return one === undefined || one === null || one === '' ? null : String(one);
}

/** Give every reference to `dbId` its new display name, so the reactions and summations citing it show it. */
function rename(out: SessionUserInstances, dbId: number, displayName: string): void {
  for (const i of [...raw(out), ...(out.updatedInstances as unknown as Raw[])]) {
    for (const v of Object.values(i.attributes ?? {})) {
      (Array.isArray(v) ? v : [v]).forEach(x => { if (isRef(x) && x.dbId === dbId) x.displayName = displayName; });
    }
  }
}
