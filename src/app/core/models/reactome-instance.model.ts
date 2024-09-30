/**
 * This TypeScript file contains TS artfacts which are used to model an instance in the Reactome Schema.
 */

import { Position } from "ngx-reactome-diagram/lib/model/diagram.model";
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

/**
 * Data structre defined for search instance
 */
export interface AttributeCondition {
  attributeName: string;
  operand: string;
  searchKey: string;
  //index: number;
}

export interface Referrer {
  attributeName: string;
  referrers: Instance[];
}

/**
 * This interface is to model a set of objects that are persisted before committed into
 * the database, such as new instances, changed instances, and deleted instances. These
 * objects also include bookmarks and some other user specific ones.
 */
export interface UserInstances {
  newInstances: Instance[],
  updatedInstances: Instance[],
  deletedInstances: Instance[],
  bookmarks: Instance[]
}


/**
 * Use to flag a node that is added as a control point for a rounded curve segment.
 */
export const EDGE_POINT_CLASS: string = 'edge_point';

export const NEW_DISPLAY_NAME: string = 'To be generated';

// Some rendering related information copied from the Java desktop version
export const RENDERING_CONSTS = {
    // distance from the reaction node to a PE node, used in reaction layout
    DEFAULT_DISTANCE_FROM_REACTION_PE_NODE: 150,
    // Use to breakdown a long display name
    WORD_WRAP_RE: /([\ /,:;-])/,
    // private readonly WORD_WRAP_RE_G = /([\ /,:;-])/g;
    DEFAULT_NODE_WIDTH: 130,
    MIN_NODE_WIDTH: 10,
    WIDTH_RATIO_OF_BOUNDS_TO_TEXT: 1.3,
    HEIGHT_RATIO_OF_BOUNDS_TO_TEXT: 1.5,
    NODE_BOUND_PADDING: 10,
    // As specified org.gk.render.ConnectWidget's BUFFER
    // Most likely we should create a new class or interface to group all these readonly
    // configuration together. Put it for the time being.
    CONNECT_BUFFER: 3,
    // Since complex has some decoration, we need to assign a mini height. Otherwise, the decoration
    // may be off.
    COMPLEX_MIN_HEIGHT: 50,
    // Distance between two layers of compartment
    RECTANGLE_DIST: 10, 

    // This is arbitrary
    INIT_POSITION: {
        x: 50,
        y: 50
    } as Position,
} as const;
