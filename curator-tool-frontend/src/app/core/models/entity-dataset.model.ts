export interface EntriesData {
    authored: {};
    compartment: {};
    created: {};
    crossReference: {};
    dbId: number;
    displayName: string;
  }

  export class EntriesTableData implements EntriesData {
    authored: {};
    compartment: {};
    created: {};
    crossReference: {};
    dbId: number;
    displayName: string;

    constructor(
      authored: {},
        compartment: {},
        created: {},
        crossReference: {},
        dbId: number,
        displayName: string){
            this.authored = authored;
            this.compartment = compartment;
            this.created = created;
            this.crossReference = crossReference;
            this.dbId = dbId;
            this.displayName = displayName;
        }
}