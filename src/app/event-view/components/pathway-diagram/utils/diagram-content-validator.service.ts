/**
 * Read-only detection of drawn-diagram-vs-database mismatches (display names for
 * PhysicalEntity nodes, sub-Pathway nodes, and Compartments; structure for
 * reactions), plus a live-diagram auto-fix that reuses the existing
 * PathwayDiagramValidator reconciliation logic.
 *
 * This class must never mutate cached Instance objects during detection.
 * Auto-fix mutates the live cytoscape instance only; it never saves/persists.
 */
import { Injectable } from "@angular/core";
import { Core } from "cytoscape";
import { Observable, switchMap, map, from, mergeMap, toArray, of, catchError, timeout } from "rxjs";
import { DataService } from "src/app/core/services/data.service";
import { Instance } from "src/app/core/models/reactome-instance.model";
import { QAReport, QAResults } from "src/app/core/models/qa-report.model";
import { REACTION_TYPES } from "src/app/core/models/reactome-schema.model";
import { Diagram, Node as DiagramNode, Edge as DiagramEdge, Compartment, EdgeConnector } from "ngx-reactome-diagram/lib/model/diagram.model";
import { PathwayDiagramValidator } from "./pathway-diagram-validator";

const ROLE_ATTRIBUTES = ['input', 'output', 'catalyst', 'activator', 'inhibitor'] as const;
type Role = typeof ROLE_ATTRIBUTES[number];
type RoleMap = Record<Role, Map<number, number>>;

interface DisplayNameEntity {
  reactomeId: number;
  displayName: string;
}

export interface DiagramValidationResult {
  report: QAReport;
  diagram: Diagram;
  instances: Instance[];
  helperInstances: Instance[];
}

@Injectable()
export class PathwayDiagramContentValidator {

  // DataService.isPhysicalEntityClass() re-walks the whole PhysicalEntity schema
  // subtree from scratch on every call; a diagram can have hundreds of nodes but
  // only a handful of distinct schemaClass values, so memoize per class name
  // rather than re-answering the same question repeatedly.
  private physicalEntityClassCache = new Map<string, boolean>();

  constructor(private dataService: DataService,
              private liveValidator: PathwayDiagramValidator) {
  }

  private isPhysicalEntityClassMemoized(schemaClass: string): boolean {
    let result = this.physicalEntityClassCache.get(schemaClass);
    if (result === undefined) {
      result = this.dataService.isPhysicalEntityClass(schemaClass);
      this.physicalEntityClassCache.set(schemaClass, result);
    }
    return result;
  }

  // DataService.fetchInstances() fires one GET findByDbId/{id} request per id
  // via forkJoin, which subscribes to ALL of them essentially simultaneously and
  // waits for every single one to complete -- none of these requests has a
  // timeout, so a diagram with 50-100+ drawn instances can genuinely hang
  // forever if the backend stalls on even one request (e.g. thread/connection
  // pool exhaustion from the burst). Fetch with bounded concurrency and a
  // per-request timeout instead: a stuck request is skipped (that entity's
  // checks are just omitted, same as any other unresolvable dbId) rather than
  // wedging the whole validation.
  private static readonly FETCH_CONCURRENCY = 6;
  private static readonly FETCH_TIMEOUT_MS = 15000;
  // Some dbIds (e.g. ATP, ADP -- extremely heavily cross-referenced entities)
  // deterministically hang on the backend's findByDbId endpoint until timeout.
  // The same dbId can legitimately need fetching more than once across a single
  // validate() run (e.g. once as a drawn node, again as a database-only
  // reference), so remember a recent failure and skip re-attempting it for a
  // while instead of paying the full timeout penalty every time it comes up.
  private static readonly FAILED_ID_TTL_MS = 5 * 60 * 1000;
  private failedIdAt = new Map<number, number>();

  private fetchInstancesThrottled(dbIds: number[]): Observable<Instance[]> {
    const now = Date.now();
    const idsToFetch: number[] = [];
    for (const dbId of dbIds) {
      const failedAt = this.failedIdAt.get(dbId);
      if (failedAt !== undefined && now - failedAt < PathwayDiagramContentValidator.FAILED_ID_TTL_MS) {
        console.warn(`[diagram validation] instance ${dbId} recently failed to resolve, skipping retry.`);
        continue;
      }
      idsToFetch.push(dbId);
    }
    if (idsToFetch.length === 0) return of([]);
    return from(idsToFetch).pipe(
      mergeMap(dbId => this.dataService.fetchInstance(dbId).pipe(
        timeout(PathwayDiagramContentValidator.FETCH_TIMEOUT_MS),
        catchError(err => {
          console.warn(`[diagram validation] instance ${dbId} did not resolve in time, skipping:`, err);
          this.failedIdAt.set(dbId, Date.now());
          return of(undefined);
        })
      ), PathwayDiagramContentValidator.FETCH_CONCURRENCY),
      toArray(),
      map(results => results.filter((i): i is Instance => !!i))
    );
  }

  validate(pathwayId: string): Observable<DiagramValidationResult> {
    // Timing instrumentation to see whether wall-clock time is dominated by
    // network round trips or by the comparison logic itself. Remove once
    // performance has been characterized, or keep behind a debug flag.
    const t0 = performance.now();
    let tDiagramFetched = 0, tMainFetched = 0, tHelpersFetched = 0, tMissingFetched = 0;
    const elapsed = () => `${(performance.now() - t0).toFixed(0)}ms`;

    console.log(`[diagram validation] pathway=${pathwayId} starting...`);

    return this.dataService.fetchRawDiagram(pathwayId).pipe(
      switchMap((diagram: Diagram) => {
        tDiagramFetched = performance.now();
        const peNodes = diagram.nodes.filter(n => this.isPhysicalEntityClassMemoized(n.schemaClass));
        const subPathwayNodes = diagram.nodes.filter(n => n.schemaClass === 'Pathway');
        const reactionEdges = diagram.edges.filter(e => REACTION_TYPES.includes(e.schemaClass));
        const compartments = diagram.compartments ?? [];
        const idToNode = new Map<number, DiagramNode>(diagram.nodes.map(n => [n.id, n]));

        const allIds = new Set<number>();
        peNodes.forEach(n => allIds.add(n.reactomeId));
        subPathwayNodes.forEach(n => allIds.add(n.reactomeId));
        reactionEdges.forEach(e => allIds.add(e.reactomeId));
        compartments.forEach(c => allIds.add(c.reactomeId));

        console.log(
          `[diagram validation] ${elapsed()} raw diagram fetched: ` +
          `${diagram.nodes.length} nodes (${peNodes.length} PE, ${subPathwayNodes.length} sub-pathway), ` +
          `${diagram.edges.length} edges (${reactionEdges.length} reactions), ${compartments.length} compartments. ` +
          `Fetching ${allIds.size} unique instances individually (GET findByDbId per id)...`
        );

        // Note: DataService.fetchInstanceInBatch()/`POST findByDbIds` is a
        // deprecated, effectively-unsupported endpoint (confirmed not reliable) --
        // use the safe, supported singular `GET findByDbId/{id}` endpoint per id
        // instead (still cache-aware), via fetchInstancesThrottled() above.
        return this.fetchInstancesThrottled([...allIds]).pipe(
          switchMap((instances: Instance[]) => {
            tMainFetched = performance.now();
            const idToInstance = new Map<number, Instance>(instances.map(i => [i.dbId, i]));
            const reactionInstances = reactionEdges
              .map(e => idToInstance.get(e.reactomeId))
              .filter((i): i is Instance => !!i);

            const helperDbIds = new Set<number>();
            for (const reaction of reactionInstances) {
              for (const att of ['catalystActivity', 'regulatedBy']) {
                const values: Instance[] = reaction.attributes?.get(att) ?? [];
                for (const v of values) {
                  if (v?.dbId) helperDbIds.add(v.dbId);
                }
              }
            }

            console.log(
              `[diagram validation] ${elapsed()} main fetch done (${instances.length}/${allIds.size} instances, ` +
              `took ${(tMainFetched - tDiagramFetched).toFixed(0)}ms). ` +
              `Fetching ${helperDbIds.size} catalyst/regulator helper instances...`
            );

            return this.fetchInstancesThrottled([...helperDbIds]).pipe(
              switchMap((helperInstances: Instance[]) => {
                tHelpersFetched = performance.now();
                const helperById = new Map<number, Instance>(helperInstances.map(h => [h.dbId, h]));
                // The database side of a reaction's structure can reference entities
                // that aren't drawn in the diagram at all (e.g. a regulator added to
                // the DB after the diagram was last generated) -- those were never
                // added to `allIds` above, so fetch their display names too, or the
                // report has nothing to show but the bare dbId for them.
                const missingIds = new Set<number>();
                for (const reaction of reactionInstances) {
                  const dbStructure = this.deriveReactionStructure(reaction, helperById);
                  for (const role of ROLE_ATTRIBUTES) {
                    for (const dbId of dbStructure[role].keys()) {
                      if (!idToInstance.has(dbId)) missingIds.add(dbId);
                    }
                  }
                }

                console.log(
                  `[diagram validation] ${elapsed()} helper fetch done (${helperInstances.length}/${helperDbIds.size} instances, ` +
                  `took ${(tHelpersFetched - tMainFetched).toFixed(0)}ms). ` +
                  `Fetching ${missingIds.size} DB-only (undrawn) referenced instances...`
                );

                return this.fetchInstancesThrottled([...missingIds]).pipe(
                  map((extraInstances: Instance[]) => {
                    tMissingFetched = performance.now();
                    console.log(
                      `[diagram validation] ${elapsed()} missing-entity fetch done (${extraInstances.length}/${missingIds.size} instances, ` +
                      `took ${(tMissingFetched - tHelpersFetched).toFixed(0)}ms). Building report...`
                    );
                    extraInstances.forEach(i => idToInstance.set(i.dbId, i));
                    const report = this.buildReport(
                      pathwayId, diagram, peNodes, subPathwayNodes, reactionEdges, compartments,
                      idToInstance, idToNode, reactionInstances, helperInstances
                    );
                    const tDone = performance.now();
                    console.log(
                      `[diagram validation timing] pathway=${pathwayId} ` +
                      `total=${(tDone - t0).toFixed(0)}ms | ` +
                      `rawDiagramFetch=${(tDiagramFetched - t0).toFixed(0)}ms, ` +
                      `mainFetch(${allIds.size} ids)=${(tMainFetched - tDiagramFetched).toFixed(0)}ms, ` +
                      `helperFetch(${helperDbIds.size} ids)=${(tHelpersFetched - tMainFetched).toFixed(0)}ms, ` +
                      `missingFetch(${missingIds.size} ids)=${(tMissingFetched - tHelpersFetched).toFixed(0)}ms, ` +
                      `comparisonLogic=${(tDone - tMissingFetched).toFixed(0)}ms`
                    );
                    return { report, diagram, instances: [...idToInstance.values()], helperInstances };
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  private buildReport(
    pathwayId: string,
    diagram: Diagram,
    peNodes: DiagramNode[],
    subPathwayNodes: DiagramNode[],
    reactionEdges: DiagramEdge[],
    compartments: Compartment[],
    idToInstance: Map<number, Instance>,
    idToNode: Map<number, DiagramNode>,
    reactionInstances: Instance[],
    helperInstances: Instance[]
  ): QAReport {
    const peCheck = this.checkDisplayNames('PhysicalEntity Display Names', peNodes, idToInstance);
    const subPathwayCheck = this.checkDisplayNames('Sub-Pathway Display Names', subPathwayNodes, idToInstance);
    const compartmentCheck = this.checkDisplayNames('Compartment Display Names', compartments, idToInstance);
    const structureCheck = this.checkReactionStructure(reactionEdges, idToNode, idToInstance, reactionInstances, helperInstances);

    return {
      instance: { dbId: Number(pathwayId), displayName: diagram.displayName, schemaClassName: 'Pathway' } as Instance,
      qaResults: [peCheck, subPathwayCheck, structureCheck, compartmentCheck]
    };
  }

  private checkDisplayNames(checkName: string, entities: DisplayNameEntity[], idToInstance: Map<number, Instance>): QAResults {
    const rows: string[][] = [];
    for (const entity of entities) {
      const dbInstance = idToInstance.get(entity.reactomeId);
      if (!dbInstance) continue;
      // The pre-generated diagram JSON bakes zero-width-space characters (U+200B)
      // into displayName after punctuation for word-wrapping -- invisible layout
      // hints, not semantic content -- so strip them before comparing/reporting.
      const diagramDisplayName = this.normalizeDrawnDisplayName(entity.displayName);
      // Database displayNames also carry a trailing "[compartment]" suffix that
      // diagram-drawn labels never include (the same stripping
      // PathwayDiagramValidator.validateDisplayName already applies when writing
      // a fixed label onto the diagram), so compare against the stripped form.
      const dbDisplayName = this.stripCompartmentSuffix(dbInstance.displayName);
      if (dbDisplayName !== diagramDisplayName) {
        rows.push([
          JSON.stringify({ dbId: entity.reactomeId, displayName: diagramDisplayName }),
          diagramDisplayName,
          dbDisplayName ?? ''
        ]);
      }
    }
    return {
      checkName,
      passed: rows.length === 0,
      columns: ['Entity', 'Diagram Label', 'Database Label'],
      rows
    };
  }

  private checkReactionStructure(
    reactionEdges: DiagramEdge[],
    idToNode: Map<number, DiagramNode>,
    idToInstance: Map<number, Instance>,
    reactionInstances: Instance[],
    helperInstances: Instance[]
  ): QAResults {
    const helperById = new Map<number, Instance>(helperInstances.map(h => [h.dbId, h]));
    const reactionById = new Map<number, Instance>(reactionInstances.map(r => [r.dbId, r]));
    const rows: string[][] = [];

    for (const edge of reactionEdges) {
      const reaction = reactionById.get(edge.reactomeId);
      if (!reaction) continue;
      const diagramStructure = this.deriveDiagramReactionStructure(edge, idToNode);
      const dbStructure = this.deriveReactionStructure(reaction, helperById);
      // Reactions have no drawn label to compare (edge.displayName isn't reliably
      // populated in the raw diagram JSON, and reactions never render a label
      // anyway), so use the database instance's displayName just as a readable
      // identifier for this row -- not a comparison target.
      const reactionCell = JSON.stringify({ dbId: edge.reactomeId, displayName: reaction.displayName ?? String(edge.reactomeId) });

      for (const role of ROLE_ATTRIBUTES) {
        const diff = this.diffMultisets(diagramStructure[role], dbStructure[role]);
        for (const dbId of diff.missingInDiagram) {
          rows.push([reactionCell, role, this.entityCell(dbId, idToInstance), 'in database but not drawn']);
        }
        for (const dbId of diff.missingInDb) {
          rows.push([reactionCell, role, this.entityCell(dbId, idToInstance), 'drawn but not in database']);
        }
        for (const mismatch of diff.mismatchedCounts) {
          rows.push([reactionCell, role, this.entityCell(mismatch.dbId, idToInstance),
            `stoichiometry mismatch: diagram=${mismatch.diagramCount}, db=${mismatch.dbCount}`]);
        }
      }
    }

    return {
      checkName: 'Reaction Structure',
      passed: rows.length === 0,
      columns: ['Reaction', 'Role', 'Entity', 'Issue'],
      rows
    };
  }

  private entityCell(dbId: number, idToInstance: Map<number, Instance>): string {
    return JSON.stringify({ dbId, displayName: idToInstance.get(dbId)?.displayName ?? String(dbId) });
  }

  /**
   * Same regex PathwayDiagramValidator.validateDisplayName uses: drops a trailing
   * " [compartment]" suffix, since diagram-drawn labels never include it.
   */
  private stripCompartmentSuffix(displayName: string | undefined): string | undefined {
    return displayName?.replace(/\s*\[.*?\]$/, '');
  }

  /**
   * A displayName is conceptually always a single-line string. The
   * pre-generated diagram JSON bakes zero-width-space characters (U+200B)
   * after certain punctuation, and/or actual line breaks, into displayName
   * purely for word-wrapping when drawn (mirroring
   * RENDERING_CONSTS.WORD_WRAP_RE). None of that is semantic content, so
   * strip it all out (not replace with a space -- these are wrap points, not
   * word separators) before comparing against or displaying alongside the
   * database's displayName.
   */
  private normalizeDrawnDisplayName(displayName: string | undefined): string {
    // The raw diagram JSON's typings claim displayName is always populated, but
    // that's not reliably true in practice (e.g. reaction edges) -- guard here
    // too rather than trusting the type declaration.
    return displayName?.replace(/[\u200B\r\n]/g, '') ?? '';
  }

  private emptyRoleMap(): RoleMap {
    return { input: new Map(), output: new Map(), catalyst: new Map(), activator: new Map(), inhibitor: new Map() };
  }

  private deriveDiagramReactionStructure(edge: DiagramEdge, idToNode: Map<number, DiagramNode>): RoleMap {
    const result = this.emptyRoleMap();
    const roleConnectors: { role: Role, connectors: EdgeConnector[] }[] = [
      { role: 'input', connectors: edge.inputs ?? [] },
      { role: 'output', connectors: edge.outputs ?? [] },
      { role: 'catalyst', connectors: edge.catalysts ?? [] },
      { role: 'activator', connectors: edge.activators ?? [] },
      { role: 'inhibitor', connectors: edge.inhibitors ?? [] },
    ];
    for (const { role, connectors } of roleConnectors) {
      for (const connector of connectors) {
        const node = idToNode.get(connector.id);
        if (!node) continue;
        const count = connector.stoichiometry ?? 1;
        result[role].set(node.reactomeId, (result[role].get(node.reactomeId) ?? 0) + count);
      }
    }
    return result;
  }

  /**
   * Mirrors InstanceUtilities.addHelpersToReaction's classification exactly
   * (CatalystActivity goes to catalyst; a Negative-named regulation goes to
   * inhibitor; a Positive-named regulation or Requirement goes to activator)
   * but returns fresh dbId-count Maps instead of mutating the reaction's
   * attributes map, since fetchInstances' results are shared, cached Instance
   * objects.
   */
  private deriveReactionStructure(reaction: Instance, helperById: Map<number, Instance>): RoleMap {
    const result = this.emptyRoleMap();
    this.accumulate(result.input, reaction.attributes?.get('input'));
    this.accumulate(result.output, reaction.attributes?.get('output'));

    const catalystActivities: Instance[] = reaction.attributes?.get('catalystActivity') ?? [];
    for (const ca of catalystActivities) {
      const helper = helperById.get(ca.dbId);
      const pe = helper?.attributes?.get('physicalEntity');
      if (pe?.dbId) result.catalyst.set(pe.dbId, (result.catalyst.get(pe.dbId) ?? 0) + 1);
    }

    const regulations: Instance[] = reaction.attributes?.get('regulatedBy') ?? [];
    for (const reg of regulations) {
      const helper = helperById.get(reg.dbId);
      if (!helper) continue;
      const pe = helper.attributes?.get('regulator');
      if (!pe?.dbId) continue;
      if (helper.schemaClassName.includes('Negative')) {
        result.inhibitor.set(pe.dbId, (result.inhibitor.get(pe.dbId) ?? 0) + 1);
      } else if (helper.schemaClassName.includes('Positive') || helper.schemaClassName === 'Requirement') {
        result.activator.set(pe.dbId, (result.activator.get(pe.dbId) ?? 0) + 1);
      }
    }
    return result;
  }

  private accumulate(map: Map<number, number>, values: Instance[] | undefined) {
    for (const v of values ?? []) {
      if (v?.dbId) map.set(v.dbId, (map.get(v.dbId) ?? 0) + 1);
    }
  }

  private diffMultisets(diagramMap: Map<number, number>, dbMap: Map<number, number>) {
    const missingInDiagram: number[] = [];
    const missingInDb: number[] = [];
    const mismatchedCounts: { dbId: number, diagramCount: number, dbCount: number }[] = [];
    const allIds = new Set<number>([...diagramMap.keys(), ...dbMap.keys()]);
    for (const dbId of allIds) {
      const diagramCount = diagramMap.get(dbId) ?? 0;
      const dbCount = dbMap.get(dbId) ?? 0;
      if (diagramCount === 0) missingInDiagram.push(dbId);
      else if (dbCount === 0) missingInDb.push(dbId);
      else if (diagramCount !== dbCount) mismatchedCounts.push({ dbId, diagramCount, dbCount });
    }
    return { missingInDiagram, missingInDb, mismatchedCounts };
  }

  /**
   * Applies corrections directly to the live cytoscape instance. Deliberately does
   * NOT save/persist anything -- the caller (PathwayDiagramComponent) is
   * responsible for treating this like any other live edit (undo snapshot +
   * markDiagramEdited), leaving the actual save to the curator's existing,
   * separate Save action.
   */
  autoFix(result: DiagramValidationResult, cy: Core): void {
    const { report, diagram, instances } = result;
    const idToInstance = new Map<number, Instance>(instances.map(i => [i.dbId, i]));

    for (const checkName of ['PhysicalEntity Display Names', 'Sub-Pathway Display Names']) {
      const check = report.qaResults.find(r => r.checkName === checkName);
      if (!check || check.passed || !check.rows) continue;
      for (const row of check.rows) {
        const { dbId } = JSON.parse(row[0]);
        const dbInstance = idToInstance.get(dbId);
        if (!dbInstance) continue;
        cy.elements(`[reactomeId = ${dbId}]`).forEach((elm: any) => this.liveValidator.validateDisplayName(elm, dbInstance));
      }
    }

    const compartmentCheck = report.qaResults.find(r => r.checkName === 'Compartment Display Names');
    if (compartmentCheck && !compartmentCheck.passed && compartmentCheck.rows) {
      const reactomeIdToCompartment = new Map((diagram.compartments ?? []).map(c => [c.reactomeId, c]));
      for (const row of compartmentCheck.rows) {
        const { dbId } = JSON.parse(row[0]);
        const dbInstance = idToInstance.get(dbId);
        const compartment = reactomeIdToCompartment.get(dbId);
        if (!dbInstance || !compartment) continue;
        const outer = cy.getElementById(`${compartment.id}-outer`);
        if (outer && outer.length > 0) outer.data('displayName', dbInstance.displayName);
      }
    }

    const structureCheck = report.qaResults.find(r => r.checkName === 'Reaction Structure');
    if (structureCheck && !structureCheck.passed && structureCheck.rows) {
      const flaggedReactionIds = new Set<number>();
      for (const row of structureCheck.rows) {
        const { dbId } = JSON.parse(row[0]);
        flaggedReactionIds.add(dbId);
      }
      for (const reactionDbId of flaggedReactionIds) {
        const reaction = idToInstance.get(reactionDbId);
        if (!reaction) continue;
        for (const attribute of ['input', 'output', 'catalystActivity', 'regulatedBy']) {
          this.liveValidator.handleInstanceEdit(reaction, attribute, cy);
        }
      }
    }
  }
}
