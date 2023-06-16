export interface AttributeData {
    name: string;
    properties: {};
  }

  export class AttributTableData implements AttributeData {
    name: string;
    properties: {};

    constructor(name: string, properties: {}){
        this.name = name;
        this.properties = properties;
    }
}
  