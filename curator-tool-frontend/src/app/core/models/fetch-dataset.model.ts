export interface AttributeData {
    name: string;
    // properties: {
    //     cardinality: string;
    //     valueType: string;
    //     attributeOrigin: string;
    // }
  }

  export class AttributTableData implements AttributeData {
    name: string;
    // properties: {
    //     cardinality: string;
    //     valueType: string;
    //     attributeOrigin: string;
    // }


    constructor(name: string){
        this.name = name;
        // this.properties = properties;
        // this.properties.cardinality = properties.cardinality;
        // this.properties.valueType = properties.valueType;
        // this.properties.attributeOrigin = properties.attributeOrigin;
    }
}
  