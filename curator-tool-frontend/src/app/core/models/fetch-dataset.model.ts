export interface AttributeData {
  category: string,
  definingType: string,
  name: string;
  properties: {};
}

export class AttributTableData implements AttributeData {
  category: string;
  definingType: string;
  name: string;
  properties: {};

  constructor(category: string, definingType:string, name: string, properties: {}) {
    this.category = category;
    this.definingType = definingType;
    this.name = name;
    this.properties = properties;
  }
}
