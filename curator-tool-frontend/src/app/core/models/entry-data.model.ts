export interface EntryData<T = any> {
    key: string;
    value: T;
    type: Type;
}

export type Type =
    "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" | "array";
