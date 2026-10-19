import { Injectable, inject } from '@angular/core';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { SchemaClass } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';
import { NLQueryResponse } from './nl-query.service';

const ROOT_CLASS = 'DatabaseObject';

/** The names a query may give, after an optional prefix, to an instance's name and class. */
const NAME_KEYS = ['displayName', 'name'];
const CLASS_KEYS = ['schemaClass', 'schemaClassName', 'cls', 'class'];

/** What an embedded instance list needs to show the instances of one source of a result. */
export interface ResultListing {
  className: string;
  instances: Instance[];
}

/**
 * Turns an Ask the Graph result into instances for the schema view's instance list, straight
 * from the rows the query already returned rather than looking them up again. The instances
 * are listed under the most specific schema class they all share (e.g. a mix of Reactions and
 * BlackBoxEvents under ReactionlikeEvent).
 *
 * The query agent shapes its results freely, so the instances are looked for in two places,
 * each of which is a "source" the curator can list:
 * - a dbId column, e.g. "r.dbId", paired with the name and class columns sharing its prefix
 *   ("r.displayName", "r.schemaClass");
 * - a column holding maps or lists of maps, e.g. collect({dbId: r.dbId, name: r.displayName,
 *   cls: r.schemaClass}) AS sample, or a whole node. Its source is named "sample.dbId".
 * Names and classes go by a few common aliases (NAME_KEYS, CLASS_KEYS). Without a class the
 * instances are listed as DatabaseObjects.
 */
@Injectable({ providedIn: 'root' })
export class ResultListingService {
  private dataService = inject(DataService);

  /** The sources of a result that hold at least one dbId, so there is something to list. */
  sources(response: NLQueryResponse): string[] {
    const sources: string[] = [];
    for (const column of response.columns) {
      if (this.isDbIdKey(column)) {
        if (response.rows.some(row => this.toDbId(row[column]) !== undefined)) sources.push(column);
        continue;
      }
      const keys = new Set<string>();
      for (const row of response.rows)
        for (const record of this.records(row[column]))
          Object.keys(record).filter(k => this.isDbIdKey(k) && this.toDbId(record[k]) !== undefined)
            .forEach(k => keys.add(k));
      keys.forEach(k => sources.push(`${column}.${k}`));
    }
    return sources;
  }

  listing(response: NLQueryResponse, source: string): ResultListing {
    const records = response.columns.includes(source)
      ? response.rows.map(row => ({ record: row, dbIdKey: source }))
      : this.nestedRecords(response, source);

    const byDbId = new Map<number, Instance>();
    for (const { record, dbIdKey } of records) {
      const dbId = this.toDbId(record[dbIdKey]);
      if (dbId === undefined || byDbId.has(dbId)) continue;
      const prefix = dbIdKey.slice(0, dbIdKey.length - 'dbId'.length);
      byDbId.set(dbId, {
        dbId,
        displayName: this.sibling(record, prefix, NAME_KEYS),
        schemaClassName: this.sibling(record, prefix, CLASS_KEYS) ?? ROOT_CLASS,
      });
    }
    const instances = [...byDbId.values()];
    return { className: this.commonAncestor([...new Set(instances.map(inst => inst.schemaClassName))]), instances };
  }

  /** The deepest class that is, or is an ancestor of, every one of the given classes. */
  commonAncestor(classNames: string[]): string {
    if (!classNames.length) return ROOT_CLASS;
    const paths = classNames.map(name => this.pathFromRoot(name));
    let common = paths[0];
    for (const path of paths.slice(1)) {
      let i = 0;
      while (i < common.length && i < path.length && common[i] === path[i]) i++;
      common = common.slice(0, i);
    }
    return common.length ? common[common.length - 1] : ROOT_CLASS;
  }

  isDbIdKey(key: string): boolean {
    return /(^|\.|_)dbId$/i.test(key);
  }

  /** The maps in a nested source, "column.key", each with the key that holds its dbId. */
  private nestedRecords(response: NLQueryResponse, source: string): { record: Record<string, unknown>, dbIdKey: string }[] {
    const column = response.columns.find(c => source.startsWith(c + '.') && this.isDbIdKey(source.slice(c.length + 1)));
    if (!column) return [];
    const dbIdKey = source.slice(column.length + 1);
    return response.rows.flatMap(row => this.records(row[column]).map(record => ({ record, dbIdKey })));
  }

  /** A cell's maps: the cell itself if it is one, or the maps in it if it is a list. */
  private records(value: unknown): Record<string, unknown>[] {
    const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
    if (Array.isArray(value)) return value.filter(isRecord);
    return isRecord(value) ? [value] : [];
  }

  private sibling(record: Record<string, unknown>, prefix: string, names: string[]): string | undefined {
    const wanted = names.map(name => (prefix + name).toLowerCase());
    const key = Object.keys(record).find(k => wanted.includes(k.toLowerCase()));
    const value = key === undefined ? undefined : record[key];
    return value == null || value === '' ? undefined : String(value);
  }

  private toDbId(value: unknown): number | undefined {
    const dbId = value == null || value === '' ? NaN : Number(value);
    return Number.isInteger(dbId) ? dbId : undefined;
  }

  /** Uses the schema class tree DataService loads when the app starts, so no request is made. */
  private pathFromRoot(className: string): string[] {
    const path: string[] = [];
    for (let cls: SchemaClass | undefined = this.dataService.getSchemaClass(className); cls; cls = cls.parent)
      path.unshift(cls.name);
    return path;
  }
}
