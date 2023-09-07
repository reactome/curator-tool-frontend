// The typed values for the "properties" attribute of the AttributeData
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

// Function to parse by "." and return the last string
export function toClassName(props: string) {
  if (!props) return '';
  let typeArray = props.split(".");
  let index = typeArray.length;
  return typeArray[index - 1];
}
