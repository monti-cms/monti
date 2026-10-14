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
/** What in a schema file is code (or not valid). The admin translates these; `message` carries the English sentence for the command line and logs. */
export type SchemaLiteralIssueCode = "comment_unclosed" | "string_unclosed" | "escape_malformed" | "template_expression" | "expected_token" | "expected_value" | "expected_name" | "expected_import" | "expected_module" | "expected_schema_object" | "computed_key" | "spread" | "method" | "shorthand" | "proto_key" | "duplicate_key" | "empty_slot" | "not_data" | "call" | "access" | "identifier" | "foreign_module" | "second_import" | "code_before" | "code_after";
/** The values a code's sentence names (`name`, `expected`, `found`). */
export type SchemaLiteralIssueParams = Readonly<Record<string, string>>;
export interface SchemaLiteralIssue {
    readonly code: SchemaLiteralIssueCode;
    readonly params: SchemaLiteralIssueParams;
    readonly line: number;
    readonly column: number;
}
export type SchemaLiteral = {
    readonly ok: true;
    /** The object passed to `defineSchema`. */
    readonly value: Record<string, unknown>;
    /** The file has comments; writing it again drops them. */
    readonly comments: boolean;
} | {
    readonly ok: false;
    /** What in the file is code (or not valid), with its line, in English. */
    readonly message: string;
    readonly code: SchemaLiteralIssueCode;
    readonly params: SchemaLiteralIssueParams;
    readonly line: number;
    readonly column: number;
};
/** Parses the text of a schema file that is a pure literal. A file that has code (or is not valid) is refused with a message that names the line. */
export declare function parseSchemaLiteral(text: string): SchemaLiteral;
/**
 * Where the number of `schemaVersion` sits in the text of a schema file: the property of the object passed to `defineSchema` itself, not one of a nested object, a string
 * or a comment. Unlike {@link parseSchemaLiteral} it also reads a file that holds code (a spread, a variable), because it only walks the text.
 * `start` and `end` span the number; `null` when the object has no `schemaVersion: <number>`. `insertAt` is the index just after the object's opening `{` (or `null`
 * when the file has no `defineSchema({`).
 */
export declare function locateSchemaVersion(text: string): {
    readonly number: {
        readonly start: number;
        readonly end: number;
    } | null;
    readonly insertAt: number | null;
};
