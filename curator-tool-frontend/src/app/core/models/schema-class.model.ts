export interface SchemaClassData <T = any> {
    category: string,
    definingType: string,
    name: string;
    properties: {};
    value: T;

  }

  export class SchemaTableData<T = any> implements SchemaClassData {
    category: string;
    definingType: string;
    name: string;
    properties: {};
    value: T;

    constructor(category: string, definingType: string, name: string, properties: {}, value: T){
        this.name = name;
        this.category = category;
        this.definingType = definingType;
        this.properties = properties;
        this.value = value;
    }
}