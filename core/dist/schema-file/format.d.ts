import type { SchemaFile } from "./types.js";
/** A problem in a schema file, with the path of the value. */
export interface SchemaIssue {
    /** Path from the root, e.g. `collections.post.fields.title.kind` or `locales[1].code`. Empty for the root. */
    readonly path: string;
    readonly message: string;
}
/** A schema file that is not valid. `message` lists every problem with its path. */
export declare class SchemaFileError extends Error {
    readonly issues: readonly SchemaIssue[];
    readonly source: string;
    constructor(source: string, issues: readonly SchemaIssue[]);
}
/**
 * Checks a schema file's content (the object `defineSchema` was given) and returns a copy of it. Throws a {@link SchemaFileError} naming the path of every problem.
 * `source` is what error messages call the file (its path).
 */
export declare function parseSchemaFile(input: unknown, source?: string): SchemaFile;
