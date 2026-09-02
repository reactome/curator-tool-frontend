/**
 * Read-only detection of drawn-diagram-vs-database mismatches (display names for
 * PhysicalEntity nodes, sub-Pathway nodes, and Compartments; structure for
 * reactions), plus a live-diagram auto-fix that reuses the existing
 * PathwayDiagramValidator reconciliation logic.
 *
 * Detection is backed by two lightweight backend endpoints
 * (findDisplayNamesByDbIds / findReactionStructuresByDbIds) that avoid the
 * expensive "every relationship in both directions" query used by
 * fetchInstance()/fetchInstanceInBatch(), which can hang for heavily
 * cross-referenced entities (e.g. ATP, ADP). Auto-fix still needs full Instance
 * objects for whichever reactions are actually flagged, so it uses the existing
 * (small-scale, throttled+timeout-guarded) full-instance fetch for just that
 * subset.
 *
 * This class must never mutate cached Instance objects. Auto-fix mutates the
 * live cytoscape instance only; it never saves/persists.
 */
import { Injectable } from "@angular/core";
import { Core } from "cytoscape";
import { DiagramComponent } from "ngx-reactome-diagram";
import { Observable, switchMap, map, from, mergeMap, toArray, of, catchError, timeout } from "rxjs";
import { DataService } from "src/app/core/services/data.service";
import { EDGE_POINT_CLASS, Instance, ModifiedResidueEntry, ReactionStructureDto } from "src/app/core/models/reactome-instance.model";
import { QAReport, QAResults } from "src/app/core/models/qa-report.model";
import { Diagram, Compartment } from "ngx-reactome-diagram/lib/model/diagram.model";
import { PathwayDiagramValidator } from "./pathway-diagram-validator";
import { PathwayDiagramUtilService } from "./pathway-diagram-utils";

// Shared between checkReactionStructure() (which writes it as the "Issue" cell) and
// autoFix() (which reads it back to decide "delete the reaction" vs. "fix its structure"),
// so the two can never drift out of sync with each other.
const REACTION_DELETED_ISSUE = 'reaction deleted from database';

// Shared between checkModifiedResidues() and autoFix() for the same reason as
// REACTION_DELETED_ISSUE above -- these decide add/remove/relabel, so they must match exactly.
const RESIDUE_MISSING_ISSUE = 'in database but not drawn';
const RESIDUE_EXTRA_ISSUE = 'drawn but not in database';
const RESIDUE_DUPLICATE_ISSUE = 'drawn more than once';
const RESIDUE_LABEL_MISMATCH_ISSUE = 'label mismatch';

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
  idToDisplayName: Map<number, string>;
}

@Injectable()
export class PathwayDiagramContentValidator {

  constructor(private dataService: DataService,
              private liveValidator: PathwayDiagramValidator,
              private diagramUtils: PathwayDiagramUtilService) {
  }

  // Only used by autoFix() now, to fetch full Instances for the (typically small)
  // set of reactions actually flagged as mismatched -- detection itself no longer
  // needs full Instance fetches at all. Kept throttled+timeout-guarded as extra
  // insurance against the same class of hang seen with fetchInstance() for
  // heavily cross-referenced entities.
  private static readonly FETCH_CONCURRENCY = 6;
  private static readonly FETCH_TIMEOUT_MS = 15000;
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

  /**
   * @param pathwayId the Pathway's own dbId -- used only as a fallback if pathwayDiagramId
   *                  isn't available yet.
   * @param pathwayDiagramId the PathwayDiagram instance's dbId -- the one that must be used to
   *                  fetch the raw diagram JSON, and the one the resulting report is labeled
   *                  with, since it's the actual instance whose JSON gets fetched and diffed.
   *                  These are NOT interchangeable with the Pathway's own dbId: while editing,
   *                  the "live" JSON text being edited is always keyed by the PathwayDiagram,
   *                  not the Pathway (see disableEditing()'s doc comment) -- normally a
   *                  server-side symlink makes the two resolve to the same file, but a diagram
   *                  shared by more than one Pathway (e.g. a disease-vs-normal pair) has a
   *                  PathwayDiagram whose dbId genuinely differs from the Pathway's, and fetching
   *                  by the wrong one silently validates against the wrong (or stale) diagram.
   */
  validate(pathwayId: string, pathwayDiagramId: string, cy: Core): Observable<DiagramValidationResult> {
    const t0 = performance.now();
    const elapsed = () => `${(performance.now() - t0).toFixed(0)}ms`;

    const diagramId = pathwayDiagramId || pathwayId;
    // Reaction structure, and PhysicalEntity/Sub-Pathway display names, are all derived straight
    // from the live cytoscape network (cy), NOT from the fetched Diagram JSON: that JSON is only
    // regenerated by "Upload Diagram", keyed by each represented Pathway's own dbId (not
    // pathwayDiagramId -- see PathwayDiagramService.exportPathwayDiagramJSON()), so it can be
    // stale relative to what's actually open in the editor right now (including anything
    // Auto-Fix just changed but hasn't been uploaded yet), or simply not exist at all for a
    // brand-new pathway diagram that's never been through "Upload Diagram".
    // getRole()/getConnectedPEId()/getRegulationSign() (PathwayDiagramValidator) already resolve
    // a connector's role and participant correctly, including the edge-point-chain case, so
    // reaction structure checking reuses them rather than re-deriving the same logic. Every
    // PhysicalEntity/Pathway node already carries the literal 'PhysicalEntity'/'Pathway' CSS
    // class (via DiagramService.nodeTypeMap) plus its own reactomeId/displayName as data, so no
    // schemaClass lookup -- and so no dependency on the Diagram JSON -- is needed for those
    // either. EWAS can't be distinguished from Protein/RNA/Gene by class alone, so instead of
    // filtering to EWAS specifically, every PE node is passed to the modified-residues check --
    // hasModifiedResidue only exists on EWAS in the schema, so a non-EWAS dbId there just comes
    // back with no residues and never produces a row.
    // Compartments are the one exception that still needs the Diagram JSON: a compartment node
    // loaded from the original diagram carries no reactomeId at all on the live cytoscape side
    // (see autoFix()'s compartment branch), so there's no way to identify or label it from cy
    // alone.
    const reactionNodes = cy.nodes('.reaction').not(`.${EDGE_POINT_CLASS}`);
    const toDisplayNameEntity = (n: any): DisplayNameEntity =>
      ({ reactomeId: n.data('reactomeId'), displayName: n.data('displayName') });
    const peNodes = cy.nodes('.PhysicalEntity').map(toDisplayNameEntity);
    const subPathwayNodes = cy.nodes('.Pathway').map(toDisplayNameEntity);
    return this.dataService.fetchRawDiagram(diagramId).pipe(
      switchMap((diagram: Diagram) => {
        const compartments = this.gatherCompartments(diagram, cy);

        console.log(
          `[diagram validation] ${elapsed()} raw diagram fetched: ` +
          `${peNodes.length} PE, ${subPathwayNodes.length} sub-pathway, ` +
          `${reactionNodes.length} reactions (from the live network), ${compartments.length} compartments.`
        );

        return this.dataService.fetchReactionStructuresByDbIds(reactionNodes.map((n: any) => n.data('reactomeId'))).pipe(
          switchMap((idToStructure: Map<number, ReactionStructureDto>) => {
            console.log(`[diagram validation] ${elapsed()} reaction structures fetched for ${idToStructure.size}/${reactionNodes.length} reactions.`);

            return this.dataService.fetchModifiedResiduesByDbIds(peNodes.map(n => n.reactomeId)).pipe(
              switchMap((idToResidues: Map<number, ModifiedResidueEntry[]>) => {
                console.log(`[diagram validation] ${elapsed()} modified residues fetched for ${idToResidues.size}/${peNodes.length} PE nodes.`);

                // Every dbId whose displayName we might need to show: drawn PE/sub-pathway/
                // compartment/reaction nodes, AND every participant referenced by a reaction's
                // DATABASE structure (which may include entities not drawn in the diagram at all).
                const displayNameIds = new Set<number>();
                peNodes.forEach(n => displayNameIds.add(n.reactomeId));
                subPathwayNodes.forEach(n => displayNameIds.add(n.reactomeId));
                compartments.forEach(c => displayNameIds.add(c.reactomeId));
                reactionNodes.forEach((n: any) => { displayNameIds.add(n.data('reactomeId')); });
                for (const structure of idToStructure.values()) {
                  (structure.inputs ?? []).forEach(p => displayNameIds.add(p.dbId));
                  (structure.outputs ?? []).forEach(p => displayNameIds.add(p.dbId));
                  (structure.catalysts ?? []).forEach(dbId => displayNameIds.add(dbId));
                  (structure.regulators ?? []).forEach(r => displayNameIds.add(r.dbId));
                }

                return this.dataService.fetchDisplayNamesByDbIds([...displayNameIds]).pipe(
                  map((idToDisplayName: Map<number, string>) => {
                    console.log(
                      `[diagram validation] ${elapsed()} display names fetched for ${idToDisplayName.size}/${displayNameIds.size} entities. ` +
                      `Building report...`
                    );
                    const report = this.buildReport(
                      diagramId, diagram, peNodes, subPathwayNodes, compartments,
                      reactionNodes, cy, idToStructure, idToResidues, idToDisplayName
                    );
                    console.log(`[diagram validation] ${elapsed()} done.`);
                    return { report, diagram, idToDisplayName };
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
    diagramId: string,
    diagram: Diagram,
    peNodes: DisplayNameEntity[],
    subPathwayNodes: DisplayNameEntity[],
    compartments: Compartment[],
    reactionNodes: any,
    cy: Core,
    idToStructure: Map<number, ReactionStructureDto>,
    idToResidues: Map<number, ModifiedResidueEntry[]>,
    idToDisplayName: Map<number, string>
  ): QAReport {
    const peCheck = this.checkDisplayNames('PhysicalEntity Display Names', peNodes, idToDisplayName);
    const subPathwayCheck = this.checkDisplayNames('Sub-Pathway Display Names', subPathwayNodes, idToDisplayName);
    const compartmentCheck = this.checkDisplayNames('Compartment Display Names', compartments, idToDisplayName);
    const structureCheck = this.checkReactionStructure(reactionNodes, cy, idToStructure, idToDisplayName);
    const modifiedResidueCheck = this.checkModifiedResidues(peNodes, cy, idToResidues, idToDisplayName);

    return {
      // Labeled by the PathwayDiagram, not the Pathway -- that's the actual instance whose
      // JSON was fetched and diffed against the database here.
      instance: { dbId: Number(diagramId), displayName: diagram.displayName, schemaClassName: 'PathwayDiagram' } as Instance,
      qaResults: [peCheck, subPathwayCheck, structureCheck, compartmentCheck, modifiedResidueCheck]
    };
  }

  private checkDisplayNames(checkName: string, entities: DisplayNameEntity[], idToDisplayName: Map<number, string>): QAResults {
    const rows: string[][] = [];
    for (const entity of entities) {
      // The pre-generated diagram JSON bakes zero-width-space characters (U+200B)
      // into displayName after punctuation for word-wrapping -- invisible layout
      // hints, not semantic content -- so strip them before comparing/reporting.
      const diagramDisplayName = this.normalizeDrawnDisplayName(entity.displayName);
      const dbDisplayNameRaw = idToDisplayName.get(entity.reactomeId);
      if (dbDisplayNameRaw === undefined) {
        // fetchDisplayNamesByDbIds() returns no row at all for a dbId that no longer
        // exists -- e.g. the object was deleted from the database after the diagram was
        // last generated/saved, without the diagram being regenerated to match. Flag this
        // explicitly rather than silently treating "no data came back" as "no mismatch".
        rows.push([
          JSON.stringify({ dbId: entity.reactomeId, displayName: diagramDisplayName, deleted: true }),
          diagramDisplayName,
          '(deleted from database)'
        ]);
        continue;
      }
      // Database displayNames also carry a trailing "[compartment]" suffix that
      // diagram-drawn labels never include (the same stripping
      // PathwayDiagramValidator.validateDisplayName already applies when writing
      // a fixed label onto the diagram), so compare against the stripped form.
      const dbDisplayName = this.stripCompartmentSuffix(dbDisplayNameRaw);
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

  /**
   * fetchRawDiagram() resolves to {} (not an error, not null) when no diagram.json has ever
   * been generated for this id -- e.g. a brand-new pathway diagram -- so diagram.compartments
   * is undefined, not []. Defaulting that to [] alone would leave the compartment check
   * silently skipping everything for a new diagram, though: unlike a server-loaded compartment
   * (the raw diagram JSON is the only source for those -- its outer/inner cytoscape node
   * carries no reactomeId at all, see ngx-reactome-diagram's diagram.service.ts), one the
   * curator has already added *through this tool* DOES carry reactomeId on its own outer node
   * (createNodeForInstance() sets it unconditionally). So pick those up from cy too, for
   * whichever compartments aren't already accounted for in the JSON. Shared between validate()
   * and autoFix()'s compartment branch so the two never see a different compartment list.
   */
  private gatherCompartments(diagram: Diagram, cy: Core): Compartment[] {
    const jsonCompartments = diagram.compartments ?? [];
    const jsonCompartmentIds = new Set(jsonCompartments.map(c => c.reactomeId));
    const addedCompartments: Compartment[] = cy.nodes('.Compartment.outer')
      .filter((n: any) => n.data('reactomeId') !== undefined && !jsonCompartmentIds.has(n.data('reactomeId')))
      .map((n: any) => ({
        // Reconstructs the exact cytoscape id autoFix()'s compartment branch looks up
        // (`${compartment.id}-outer`), rather than trying to rebuild it from scratch.
        id: n.id().replace(/-outer$/, ''),
        reactomeId: n.data('reactomeId'),
        displayName: n.data('displayName')
      } as Compartment));
    return [...jsonCompartments, ...addedCompartments];
  }

  private checkReactionStructure(
    reactionNodes: any,
    cy: Core,
    idToStructure: Map<number, ReactionStructureDto>,
    idToDisplayName: Map<number, string>
  ): QAResults {
    const rows: string[][] = [];

    for (const reactionNode of reactionNodes) {
      const reactomeId = reactionNode.data('reactomeId');
      const dto = idToStructure.get(reactomeId);
      if (!dto) {
        // findReactionStructuresByDbIds() returns no row at all for a dbId that no longer
        // exists -- the reaction itself was deleted from the database after the diagram was
        // last generated/saved. Flag it explicitly rather than silently skipping the whole
        // reaction, which would otherwise report a clean pass for it.
        rows.push([this.entityCell(reactomeId, idToDisplayName), '', '', REACTION_DELETED_ISSUE]);
        continue;
      }
      const diagramStructure = this.deriveDiagramReactionStructureFromCy(reactionNode, cy);
      const dbStructure = this.deriveDbReactionStructure(dto);
      // Reactions have no drawn label to compare (reactions never render one), so use the
      // database instance's displayName just as a readable identifier for this row -- not a
      // comparison target.
      const reactionCell = this.entityCell(reactomeId, idToDisplayName);

      for (const role of ROLE_ATTRIBUTES) {
        const diff = this.diffMultisets(diagramStructure[role], dbStructure[role]);
        for (const dbId of diff.missingInDiagram) {
          rows.push([reactionCell, role, this.entityCell(dbId, idToDisplayName), 'in database but not drawn']);
        }
        for (const dbId of diff.missingInDb) {
          rows.push([reactionCell, role, this.entityCell(dbId, idToDisplayName), 'drawn but not in database']);
        }
        for (const mismatch of diff.mismatchedCounts) {
          rows.push([reactionCell, role, this.entityCell(mismatch.dbId, idToDisplayName),
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

  /**
   * Compares each drawn EWAS's "node feature" marks (small labeled marks representing
   * hasModifiedResidue entries, e.g. phosphorylation sites -- see
   * instance-converter.ts's createModificationNodes()) against the database. Unlike every
   * other check here, modification marks are NOT part of the raw diagram JSON at all -- they
   * are added purely client-side whenever an EWAS node is rendered -- so this is the one
   * check that has to inspect live cytoscape elements (`cy`) rather than the fetched
   * `Diagram` object.
   *
   * peNodes here is every drawn PhysicalEntity, not just EWAS -- cytoscape node classes can't
   * tell EWAS apart from other Protein/RNA/Gene-classed nodes, but that's harmless: idToResidues
   * simply has no entry for a non-EWAS dbId (hasModifiedResidue only exists on EWAS in the
   * schema), and no marks are ever drawn for one either, so it never produces a row.
   */
  private checkModifiedResidues(
    peNodes: DisplayNameEntity[],
    cy: Core,
    idToResidues: Map<number, ModifiedResidueEntry[]>,
    idToDisplayName: Map<number, string>
  ): QAResults {
    const rows: string[][] = [];

    for (const node of peNodes) {
      const dbLabelById = new Map((idToResidues.get(node.reactomeId) ?? []).map(r => [r.dbId, r.label]));
      // Count occurrences, not just presence -- a plain "is it drawn" Map would silently
      // collapse two marks for the same residue into one (the second .set() overwriting the
      // first), missing a genuine "drawn more than once" case entirely.
      const drawnCountById = new Map<number, number>();
      const drawnLabelById = new Map<number, string>();
      cy.elements('.Modification').forEach((elm: any) => {
        if (elm.data('nodeReactomeId') !== node.reactomeId) return;
        const residueDbId = elm.data('reactomeId');
        drawnCountById.set(residueDbId, (drawnCountById.get(residueDbId) ?? 0) + 1);
        drawnLabelById.set(residueDbId, elm.data('displayName'));
      });

      const ewasCell = this.entityCell(node.reactomeId, idToDisplayName);
      const allResidueIds = new Set<number>([...dbLabelById.keys(), ...drawnCountById.keys()]);
      for (const residueDbId of allResidueIds) {
        const dbLabel = dbLabelById.get(residueDbId);
        const drawnCount = drawnCountById.get(residueDbId) ?? 0;
        const drawnLabel = drawnLabelById.get(residueDbId);
        const residueCell = JSON.stringify({ dbId: residueDbId, displayName: dbLabel ?? drawnLabel ?? String(residueDbId) });
        if (dbLabel === undefined) {
          // cy.remove() on an attribute-selector match removes every matching element, so one
          // row here correctly cleans up all copies regardless of drawnCount.
          rows.push([residueCell, ewasCell, drawnLabel ?? '', '', RESIDUE_EXTRA_ISSUE]);
        } else if (drawnCount === 0) {
          rows.push([residueCell, ewasCell, '', dbLabel, RESIDUE_MISSING_ISSUE]);
        } else if (drawnCount > 1) {
          rows.push([residueCell, ewasCell, drawnLabel ?? '', dbLabel, RESIDUE_DUPLICATE_ISSUE]);
        } else if (dbLabel !== drawnLabel) {
          rows.push([residueCell, ewasCell, drawnLabel ?? '', dbLabel, RESIDUE_LABEL_MISMATCH_ISSUE]);
        }
      }
    }

    return {
      checkName: 'Modified Residues',
      passed: rows.length === 0,
      columns: ['Modified Residue', 'EWAS', 'Drawn Label', 'Database Label', 'Issue'],
      rows
    };
  }

  private entityCell(dbId: number, idToDisplayName: Map<number, string>): string {
    return JSON.stringify({ dbId, displayName: idToDisplayName.get(dbId) ?? String(dbId) });
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

  /**
   * Derives a reaction's drawn structure straight from the live cytoscape network, by walking
   * every edge tagged with the reaction's own reactomeId and resolving each one's role and
   * connected participant via PathwayDiagramValidator's own logic (getRole()/
   * getConnectedPEId()/getRegulationSign()) -- the same logic Auto-Fix itself uses, and the
   * only place that correctly resolves a participant across a multi-segment (edge-point-chain)
   * connector. This is deliberately NOT derived from the server-generated Diagram JSON (see
   * validate()'s comment on why).
   */
  private deriveDiagramReactionStructureFromCy(reactionNode: any, cy: Core): RoleMap {
    const result = this.emptyRoleMap();
    const reactomeId = reactionNode.data('reactomeId');
    const connectedEdges = cy.edges(`[reactomeId = ${reactomeId}]`);
    for (const edge of connectedEdges) {
      const attribute = this.liveValidator.getRole(edge);
      if (!attribute) continue;
      const peId = this.liveValidator.getConnectedPEId(edge, attribute);
      if (!peId) continue;
      if (attribute === 'input' || attribute === 'output') {
        const role: Role = attribute;
        const count = edge.data('stoichiometry') ?? 1;
        result[role].set(peId, (result[role].get(peId) ?? 0) + count);
      }
      else if (attribute === 'catalystActivity') {
        result.catalyst.set(peId, (result.catalyst.get(peId) ?? 0) + 1);
      }
      else if (attribute === 'regulatedBy') {
        const sign = this.liveValidator.getRegulationSign(edge);
        if (sign === 'negative')
          result.inhibitor.set(peId, (result.inhibitor.get(peId) ?? 0) + 1);
        else if (sign === 'positive')
          result.activator.set(peId, (result.activator.get(peId) ?? 0) + 1);
      }
    }
    return result;
  }

  /**
   * Reshapes the backend's already-resolved ReactionStructureDto (catalysts and
   * regulators are resolved to actual PhysicalEntity dbIds server-side) into the
   * same dbId-count-per-role Map shape used for diffing. Regulator classification
   * (activator vs. inhibitor) mirrors InstanceUtilities.addHelpersToReaction's
   * logic exactly, just reading Neo4j labels instead of schemaClassName.
   */
  private deriveDbReactionStructure(dto: ReactionStructureDto): RoleMap {
    const result = this.emptyRoleMap();
    (dto.inputs ?? []).forEach(p => result.input.set(p.dbId, (result.input.get(p.dbId) ?? 0) + p.stoichiometry));
    (dto.outputs ?? []).forEach(p => result.output.set(p.dbId, (result.output.get(p.dbId) ?? 0) + p.stoichiometry));
    (dto.catalysts ?? []).forEach(dbId => result.catalyst.set(dbId, (result.catalyst.get(dbId) ?? 0) + 1));
    (dto.regulators ?? []).forEach(reg => {
      if ((reg.labels ?? []).some(l => l.includes('Negative'))) {
        result.inhibitor.set(reg.dbId, (result.inhibitor.get(reg.dbId) ?? 0) + 1);
      } else if ((reg.labels ?? []).some(l => l.includes('Positive') || l === 'Requirement')) {
        result.activator.set(reg.dbId, (result.activator.get(reg.dbId) ?? 0) + 1);
      }
    });
    return result;
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
  autoFix(result: DiagramValidationResult, diagramComponent: DiagramComponent): Observable<void> {
    const { report, diagram, idToDisplayName } = result;
    const cy = diagramComponent.cy;

    // Node-type-specific deletion, used when the drawn object's backing instance no longer
    // exists in the database at all -- there is nothing valid to fix its label to, so the
    // stale drawn object is removed instead. deleteNode()/deletePathwayNode() are both a
    // plain cy.remove() under the hood (PathwayDiagramUtilService), kept separate here only
    // so a future divergence between the two doesn't have to be rediscovered.
    const NODE_DELETERS: Record<string, (elm: any) => void> = {
      'PhysicalEntity Display Names': elm => this.diagramUtils.deleteNode(elm, diagramComponent),
      'Sub-Pathway Display Names': elm => this.diagramUtils.deletePathwayNode(elm, diagramComponent),
    };

    for (const checkName of ['PhysicalEntity Display Names', 'Sub-Pathway Display Names']) {
      const check = report.qaResults.find(r => r.checkName === checkName);
      if (!check || check.passed || !check.rows) continue;
      for (const row of check.rows) {
        const { dbId, deleted } = JSON.parse(row[0]);
        const elements = cy.elements(`[reactomeId = ${dbId}]`);
        if (deleted) {
          if (elements.length > 0) NODE_DELETERS[checkName](elements);
          continue;
        }
        const displayName = idToDisplayName.get(dbId);
        if (displayName === undefined) continue;
        const shell = { dbId, displayName, schemaClassName: '' } as Instance;
        elements.forEach((elm: any) => this.liveValidator.validateDisplayName(elm, shell));
      }
    }

    const compartmentCheck = report.qaResults.find(r => r.checkName === 'Compartment Display Names');
    if (compartmentCheck && !compartmentCheck.passed && compartmentCheck.rows) {
      const reactomeIdToCompartment = new Map(this.gatherCompartments(diagram, cy).map(c => [c.reactomeId, c]));
      for (const row of compartmentCheck.rows) {
        const { dbId, deleted } = JSON.parse(row[0]);
        const compartment = reactomeIdToCompartment.get(dbId);
        if (!compartment) continue;
        const outer = cy.getElementById(`${compartment.id}-outer`);
        if (!outer || outer.length === 0) continue;
        if (deleted) {
          this.diagramUtils.deleteCompartment(outer, diagramComponent);
          continue;
        }
        const displayName = idToDisplayName.get(dbId);
        if (displayName === undefined) continue;
        outer.data('displayName', displayName);
      }
    }

    const structureCheck = report.qaResults.find(r => r.checkName === 'Reaction Structure');
    const flaggedReactionIds = new Set<number>();
    if (structureCheck && !structureCheck.passed && structureCheck.rows) {
      for (const row of structureCheck.rows) {
        const { dbId } = JSON.parse(row[0]);
        if (row[3] === REACTION_DELETED_ISSUE) {
          // The reaction's own dbId no longer exists in the database -- remove the whole
          // drawn reaction (and its connectors/helper nodes) via the same HyperEdge-aware
          // deletion the "Delete" context-menu action uses, rather than trying to patch a
          // structure that has nothing left in the database to patch it against.
          const edgeElm = cy.edges(`[reactomeId = ${dbId}]`);
          if (edgeElm.length > 0) this.diagramUtils.deleteHyperEdge(edgeElm);
          continue;
        }
        flaggedReactionIds.add(dbId);
      }
    }
    // Unlike reaction structure, there is no existing handleInstanceEdit()-style resync
    // function for modification marks (see checkModifiedResidues()'s doc comment) -- fixing
    // has to add/remove/relabel individual marks itself. This needs no server round-trip:
    // every row already carries the correct database label (if any), and residue removal
    // needs no new instance fetch either.
    const modifiedResidueCheck = report.qaResults.find(r => r.checkName === 'Modified Residues');
    if (modifiedResidueCheck && !modifiedResidueCheck.passed && modifiedResidueCheck.rows) {
      for (const row of modifiedResidueCheck.rows) {
        const { dbId: residueDbId } = JSON.parse(row[0]);
        const { dbId: ewasDbId } = JSON.parse(row[1]);
        const [, , , dbLabel, issue] = row;
        const markSelector = `.Modification[nodeReactomeId = ${ewasDbId}][reactomeId = ${residueDbId}]`;
        if (issue === RESIDUE_EXTRA_ISSUE) {
          const markElm = cy.elements(markSelector);
          if (markElm.length > 0) cy.remove(markElm);
        } else if (issue === RESIDUE_MISSING_ISSUE || issue === RESIDUE_DUPLICATE_ISSUE) {
          // addModificationMark() removes every existing mark matching this exact (EWAS,
          // residue) pair before adding one back, so this also correctly collapses a
          // "drawn more than once" duplicate down to exactly one correctly-labeled mark.
          const ewasElm = cy.elements(`[reactomeId = ${ewasDbId}]`).first();
          if (ewasElm.length > 0) this.addModificationMark(ewasElm, residueDbId, dbLabel, cy);
        } else if (issue === RESIDUE_LABEL_MISMATCH_ISSUE) {
          const markElm = cy.elements(markSelector);
          if (markElm.length > 0) markElm.data('displayName', dbLabel);
        }
      }
    }

    if (flaggedReactionIds.size === 0) return of(undefined);
    // Only flagged reactions need a full Instance fetch here (not every reaction in
    // the diagram), so the existing throttled/timeout-guarded fetch is more than
    // sufficient even though it's the "slow path".
    return this.fetchInstancesThrottled([...flaggedReactionIds]).pipe(
      map((reactions: Instance[]) => {
        for (const reaction of reactions) {
          for (const attribute of ['input', 'output', 'catalystActivity', 'regulatedBy']) {
            this.liveValidator.handleInstanceEdit(reaction, attribute, cy);
          }
        }
      })
    );
  }

  /**
   * Creates one new "node feature" mark for a modified residue that exists in the database
   * but isn't drawn. Mirrors instance-converter.ts's createModificationNodes() perimeter
   * placement (minus its random jitter, which is purely cosmetic) so a freshly-added mark
   * looks consistent with the rest -- marks are draggable, so an approximate position spread
   * evenly among however many marks the EWAS already has is enough, not pixel-perfect.
   *
   * Upserts rather than blindly adding: the same EWAS dbId can legitimately be drawn more
   * than once in one diagram (e.g. the same small molecule/protein appearing at several
   * spots), and modification marks are tagged only by dbId (nodeReactomeId/reactomeId), not
   * by which specific drawn copy they belong to -- so checkModifiedResidues() can report the
   * same missing residue once per drawn copy. Without removing a stale mark first, a second
   * "add" for the same residue would try to create a cytoscape element with a duplicate id
   * (mod_<ewasDbId>_<residueDbId>) instead of just leaving the one already-correct mark alone.
   */
  private addModificationMark(ewasElm: any, residueDbId: number, label: string, cy: Core): void {
    const ewasReactomeId = ewasElm.data('reactomeId');
    const existing = cy.elements(`.Modification[nodeReactomeId = ${ewasReactomeId}][reactomeId = ${residueDbId}]`);
    if (existing.length > 0) cy.remove(existing);

    const parentWidth = ewasElm.data('width');
    const parentHeight = ewasElm.data('height');
    const parentPos = ewasElm.position();
    const existingCount = cy.elements(`.Modification[nodeReactomeId = ${ewasReactomeId}]`).length;
    const perimeter = 2 * (parentWidth + parentHeight);
    const spacing = perimeter / (existingCount + 1);
    const distanceAlongPerimeter = spacing * existingCount;

    let modX: number, modY: number;
    if (distanceAlongPerimeter < parentWidth) {
      modX = parentPos.x - parentWidth / 2 + distanceAlongPerimeter;
      modY = parentPos.y - parentHeight / 2;
    } else if (distanceAlongPerimeter < parentWidth + parentHeight) {
      modX = parentPos.x + parentWidth / 2;
      modY = parentPos.y - parentHeight / 2 + (distanceAlongPerimeter - parentWidth);
    } else if (distanceAlongPerimeter < 2 * parentWidth + parentHeight) {
      modX = parentPos.x + parentWidth / 2 - (distanceAlongPerimeter - parentWidth - parentHeight);
      modY = parentPos.y + parentHeight / 2;
    } else {
      modX = parentPos.x - parentWidth / 2;
      modY = parentPos.y + parentHeight / 2 - (distanceAlongPerimeter - 2 * parentWidth - parentHeight);
    }

    const modNodeSize = 20;
    const newModNode = cy.add({
      data: {
        id: `mod_${ewasReactomeId}_${residueDbId}`,
        reactomeId: residueDbId,
        displayName: label,
        width: modNodeSize,
        height: modNodeSize,
        // The parent's reactomeId (dbId) -- matches instance-converter.ts's
        // createModificationNodes(), used by this validator's own database-identity checks.
        nodeReactomeId: ewasReactomeId,
        // The parent's own small internal cytoscape node id -- used by the backend export
        // converter to unambiguously identify which drawn occurrence this belongs to (see
        // instance-converter.ts's createModificationNodes() for the full rationale).
        nodeId: ewasElm.data('id'),
      },
      position: { x: modX, y: modY }
    } as any)[0];
    newModNode.addClass('Modification');
  }
}
