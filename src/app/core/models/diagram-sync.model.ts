/**
 * Models for the Diagram sync QA check (GET qa/diagramSync/{dbId} in curator-tool-ws, a port of
 * the desktop CuratorTool's diagram check). The check walks the PathwayDiagrams of a Pathway and
 * all of its sub-pathways and reports events whose drawing doesn't match the database.
 *
 * The backend leaves fields with no value out of the JSON rather than sending null, so every
 * optional field here may be absent.
 */

export interface DiagramSyncIssue {
    diagramDbId: number;
    pathwayDbId: number;
    pathwayDisplayName: string;
    eventDbId: number;
    eventDisplayName: string;
    /** "Reaction", "BlackBoxEvent", ... or "Pathway" for a drawn sub-pathway node. */
    eventSchemaClass: string;
    /**
     * One of "input out of sync", "output out of sync", "catalyst out of sync",
     * "activator out of sync", "inhibitor out of sync", or
     * "precedingEvent out of sync: missing <DB_ID>".
     */
    issue: string;
    /**
     * Only on precedingEvent issues: the event at the tail of the drawn FlowLine that the flagged
     * event doesn't list in its precedingEvent slot. Use this rather than parsing `issue`.
     */
    missingPrecedingEventDbId?: number;
    /** e.g. "D'Eustachio, P, 2010-03-23" */
    created?: string;
    modified?: string;
}

export interface DiagramSyncReport {
    eventDbId: number;
    eventDisplayName: string;
    checkedDiagrams: number;
    /** Diagrams that have no diagram file to read, so they couldn't be checked. */
    uncheckedDiagramDbIds?: number[];
    issues?: DiagramSyncIssue[];
}
