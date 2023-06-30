import { MemoizedSelector } from "@ngrx/store";
import { AttributeData } from "./fetch-dataset.model";
import { AttributeDataState } from "src/app/attribute-table/state/attribute-table.reducers";

export interface KeyValuePair<T = any> {
    key: string;
    value: T;
    type: Type;
}

export type Type = 
    "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" | "array";