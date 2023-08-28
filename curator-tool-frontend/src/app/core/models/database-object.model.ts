export interface DatabaseObject<T = any> {
    key: string;
    value: T;
    type: Type;
    javaType: string;
}

export type Type =
    "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" | "array";
