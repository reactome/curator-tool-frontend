/**
 * A model for the QA Report returned for a single instance.
 */

import { Instance } from "./reactome-instance.model";

export interface QAReport {
    instance: Instance;
    qaResults: QAResults[];
}

export interface QAResults {
    checkName: string;
    passed: boolean;
    // A one-line summary of a failed check, e.g. "86 of 2410 reactions imbalanced". A check may
    // fail with an issue and no rows.
    issue?: string;
    columns?: string[];
    rows?: string[][];
}

