import type { JsonValue } from "./types.js";
/** Copies a JSON value with object keys sorted at every depth (`undefined` members are dropped). */
export declare function sortKeys(value: JsonValue): JsonValue;
