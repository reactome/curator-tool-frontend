/**
 * This TypeScript file contains TS artfacts which are used to model an instance in the Reactome Schema.
 */

import { SchemaClass } from "./reactome-schema.model";

export interface Instance {
  /**
   * This is a simplified port of the Java class for the use of the web-based curator tool. Though in the Reactome
   * data model, the top most is DatabaseObject, however, it is better to call instance to follow the standard
   * knowledge modeling terms as in OWL.
   */
  schemaClass?: SchemaClass; // This is optional so that we can have a very simple instance with dbId and displayName. Also we use
                             // the name of schemaClass to ease the handling.
  schemaClassName: string; // Hold the class name for the time being. This is required for the back-end converting.
  dbId: number;
  displayName?: string;
  attributes?: Map<string, any> | any; // This is optional so that we can have a simple shell instance. Use also any for easy converting
  modifiedAttributes?: string[] // Optional list flagging names of modified attributes
  qaIssues?: Map<string, string[][]>; // Optional map of QA check label to the corresponding tabular report
}

export interface InstanceList {
  instances: Instance[];
  totalCount: number;
}

