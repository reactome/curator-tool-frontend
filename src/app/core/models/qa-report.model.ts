/**
 * A model for the QA Report returned for a single instance.
 */

import { Instance } from "./reactome-instance.model";

export interface QAReport {
    instance: Instance;
    testsRun: QACheck[];
}

export interface QACheck {
    checkName: string;
    checkPassed: boolean;
    columns: string[];
    rows: string[][];
}

// export interface TestAttributes {
//     issueName: string;
//     issueDetails: any;
// }
