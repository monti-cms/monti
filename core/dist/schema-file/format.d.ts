import { type Issue } from "../config/check/issue.js";
import type { SchemaFile } from "./types.js";
/** The shape problems of the plain data of a merged config (collections must already be normalized). */
export declare const configShapeIssues: (config: unknown) => Issue[];
/**
 * Checks a schema file's content (the object `defineSchema` was given) and returns a copy of it. Throws a {@link ConfigError} naming the path of every problem in its shape.
 * What the values mean is checked by `defineSite`, which every schema goes through. `source` is what error messages call the file (its path).
 */
export declare function parseSchemaFile(input: unknown, source?: string): SchemaFile;
