/**
 * This type script file contains the interfaces and some utility functions related to Reactome data schema.
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
  attributes?: SchemaAttribute[];
  isAbstract?: boolean; // Default should be false. Therefore this property is optional.
  '@JavaClass'?: string; // Map back to Java.
}

export enum AttributeCategory {
  OPTIONAL,
  MANDATORY,
  REQUIRED,
  NOMANUALEDIT
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

/**
 * A utility function to parse by "." and return the last string
 */
export function toClassName(props: string) {
  if (!props) return '';
  let typeArray = props.split(".");
  let index = typeArray.length;
  return typeArray[index - 1];
}
