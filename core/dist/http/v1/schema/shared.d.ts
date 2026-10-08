import type { Cms } from "../../../cms/index.js";
/** Throws the 403 of a server that may not write the schema file. */
export declare function assertSchemaWritable(cms: Pick<Cms, "schemaFile">): void;
/** The body of a check or a save: `{ schema, transforms?, renames? }`. */
export declare function readEditBody(request: Request): Promise<{
    schema: Record<string, unknown>;
    transforms?: never[];
    renames?: never[];
    baseHash?: unknown;
}>;
