/**
 * This type script file contains the interfaces related to Reactome data schema.
 */

export interface SchemaAttribute {
  /**
   * Model an attribute of a schema class. This basically is a port of the original Java
   * SchemaAttribute, https://github.com/reactome/CuratorTool/blob/master/src/org/gk/schema/GKSchemaAttribute.java.
   * But this TS version is simplified here.
   */
  allowedClases?: string[];
  cardinality: '1'|'+';
  name: string;
  origin: string; // Class names are used in this interface to make the model easier
  category: AttributeCategory;
  definingType: AttributeDefiningType;
  type: AttributeDataType;
  // '@JavaClass': string // Disable this for the time being. Not sure why we need it.
}

export interface SchemaClass {
  /**
   * Model a SchemaClass of the Reactome model, based on the Java version and simplified here:
   * https://github.com/reactome/CuratorTool/blob/master/src/org/gk/schema/GKSchemaClass.java.
   */
  name: string;
  children?: SchemaClass[]; // Optional for the schema class table
  attributes?: SchemaAttribute[];
  abstract?: boolean; // Default should be false. Therefore this property is optional.
  count?: number; // The total count of instances in this class, including all descendants
  // '@JavaClass'?: string; // Map back to Java.
}

export enum AttributeCategory {
  OPTIONAL,
  MANDATORY,
  REQUIRED,
  NOMANUALEDIT,
  NOTDEFINED
}

export enum AttributeDefiningType {
  ALL_DEFINING,
  ANY_DEFINING,
  NONE_DEFINING,
  UNDEFINED
}

export enum AttributeDataType {
  STRING,
  INTEGER,
  FLOAT,
  BOOLEAN,
  INSTANCE
}

// To check reaction: A lazy way to list all reactions so that
// there is no need to fetch the reaction hierarchical branch.
export const REACTION_TYPES = [
      'BlackBoxEvent',
      'CellDevelopmentStep',
      'Depolymerisation',
      'Polymerisation',
      'FailedReaction',
      'Reaction'
];


// Editing of the following attributes may change the reaction's display in a pathway diagram
export const REACTION_DIAGRAM_ATTRIBUTES = [
  'input', 
  'output', 
  'catalystActivity', 
  'regulatedBy'
];
