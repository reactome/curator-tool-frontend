/**
 * This TypeScript file contains TS artfacts which are used to model an instance in the Reactome Schema.
 */

import {SchemaClass} from "./reactome-schema.model";

// export interface Instance {
//   /**
//    * This is a simplified port of the Java class for the use of the web-based curator tool. Though in the Reactome
//    * data model, the top most is DatabaseObject, however, it is better to call instance to follow the standard
//    * knowledge modeling terms as in OWL.
//    */
//   schemaClass?: SchemaClass; // This is optional so that we can have a very simple instance with dbId and displayName. Also we use
//                              // the name of schemaClass to ease the handling.
//   schemaClassName?: string; // Hold the class name for the time being
//   dbId: number;
//   displayName: string | undefined ;
//   attributes?: Map<string, any>; // This is optional so that we can have a simple shell instance
//   isShell?: boolean; // Check if this is just a shell instance. A shell instance should have both dbId and displayName
//   isDirty?: boolean; // Flag if this has been updated.
// }

export class Instance{
    /**
   * This is a simplified port of the Java class for the use of the web-based curator tool. Though in the Reactome
   * data model, the top most is DatabaseObject, however, it is better to call instance to follow the standard
   * knowledge modeling terms as in OWL.
   */
  public constructor(
    public dbId: number,
    // public displayName: string = 'This field is auto generated',
    public displayName?: string,
    public schemaClass?: SchemaClass, // This is optional so that we can have a very simple instance with dbId and displayName. Also we use
                                      // the name of schemaClass to ease the handling.
    public schemaClassName?: string, // Hold the class name for the time being
    public attributes?: Map<string, any>, // This is optional so that we can have a simple shell instance
    public isShell?: boolean, // Check if this is just a shell instance. A shell instance should have both dbId and displayName
    public isDirty?: boolean // Flag if this has been updated.
  ) {}

}
