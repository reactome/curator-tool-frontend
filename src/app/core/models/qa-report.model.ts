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
    columns: string[];
    rows: string[][];
}

// export interface TestAttributes {
//     issueName: string;
//     issueDetails: any;
// }
