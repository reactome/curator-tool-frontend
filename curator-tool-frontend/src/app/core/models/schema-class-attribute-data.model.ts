export type AttributeProperty = {
  attributeClasses: { type: string, valueTypeDatabaseObject: boolean }[],
  cardinality: '1' | '+',
  name: string,
  origin: string,
  '@JavaClass': string
}

export type Category = 'OPTIONAL' | 'MANDATORY' | 'REQUIRED' | 'NOMANUALEDIT';

export interface AttributeData {
  category: Category,
  definingType: 'UNDEFINED' | 'ALL_DEFINING',
  name: string;
  properties?: AttributeProperty;
}

export class AttributTableData implements AttributeData {
  constructor(
    public category: 'OPTIONAL' | 'MANDATORY' | 'REQUIRED' | 'NOMANUALEDIT',
    public definingType: 'UNDEFINED' | 'ALL_DEFINING',
    public name: string,
    public properties?: AttributeProperty,
    ) {
    // if(this.properties && properties) {
    //   this.properties.origin = toClassName(properties.origin);
    //   this.properties.attributeClasses[0].type = toClassName(properties.attributeClasses[0].type);
    // }
  }
}

export function toAttributeClassName(props: AttributeProperty) {
  const type = props.attributeClasses[0].type;
  let typeArray = type.split(".");
  let index = typeArray.length;
  return typeArray[index - 1];
}

export function toClassName(props: string) {
  if (!props) return '';
  let typeArray = props.split(".");
  let index = typeArray.length;
  return typeArray[index - 1];
}
