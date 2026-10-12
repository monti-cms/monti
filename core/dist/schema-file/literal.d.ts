/**
 * Reads `monti.schema.ts` as plain text when it is a pure literal: the `defineSchema` import, `export default defineSchema(<object literal>)`, and nothing else.
 * The admin's schema settings screen rewrites the file only when this accepts it, so code in the file (an import, a spread, a call, a variable) is never overwritten.
 *
 * It is a small parser of the literal subset, not of TypeScript: objects, arrays, strings (quotes, no template expressions), numbers, `true`, `false` and `null`;
 * keys that are names, strings or numbers; comments; trailing commas. Anything else is refused with the line it was found on. It accepts what `printSchemaFile`
 * writes and what a person would write by hand in the same shape. The runtime reads the schema by importing the module, never through this parser.
 */
/** The module the one import of the file names. */
export declare const SCHEMA_MODULE = "@monti-cms/core";
export type SchemaLiteral = {
    readonly ok: true;
    /** The object passed to `defineSchema`. */
    readonly value: Record<string, unknown>;
    /** The file has comments; writing it again drops them. */
    readonly comments: boolean;
} | {
    readonly ok: false;
    /** What in the file is code (or not valid), with its line. */
    readonly message: string;
    readonly line: number;
    readonly column: number;
};
/** Parses the text of a schema file that is a pure literal. A file that has code (or is not valid) is refused with a message that names the line. */
export declare function parseSchemaLiteral(text: string): SchemaLiteral;
