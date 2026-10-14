import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { SchemaClass } from 'src/app/core/models/reactome-schema.model';
import { DataService } from 'src/app/core/services/data.service';

const ROOT_CLASS = 'DatabaseObject';

/**
 * Builds a schema_view list-view URL that shows exactly a given set of instances, listed under
 * the most specific schema class they all share (e.g. a mix of Reactions and BlackBoxEvents
 * opens under ReactionlikeEvent).
 *
 * The list view has no "these dbIds" filter, but its advanced search does: the backend applies
 * Regex as toString(inst.dbId) =~ $key, a full match, so dbId Regex "1|2|3" selects exactly those
 * instances. The same filter is used once more up front, against DatabaseObject, to learn each
 * instance's class.
 */
@Injectable({ providedIn: 'root' })
export class ListViewLinkService {
  private dataService = inject(DataService);

  listViewUrl(dbIds: number[]): Observable<string> {
    const ids = [...new Set(dbIds)];
    const pattern = ids.join('|');
    return this.dataService.fetchSchemaClassTree().pipe(
      switchMap(() => this.dataService.searchInstances(ROOT_CLASS, 0, ids.length, ['dbId'], ['Regex'], [pattern])),
      map(list => {
        const classNames = [...new Set((list?.instances ?? []).map(inst => inst.schemaClassName).filter(Boolean))];
        const className = this.commonAncestor(classNames);
        const query = new URLSearchParams({ attributes: 'dbId', operands: 'Regex', searchKeys: pattern });
        return `schema_view/list_instances/${className}?${query}`;
      }),
    );
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

  private pathFromRoot(className: string): string[] {
    const path: string[] = [];
    for (let cls: SchemaClass | undefined = this.dataService.getSchemaClass(className); cls; cls = cls.parent)
      path.unshift(cls.name);
    return path;
  }
}
