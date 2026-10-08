import { type SerializeContext, type SyntaxMarkWriter, type SyntaxNodeWriter } from "@monti-cms/mdx";
export declare const directiveNodeWriters: Readonly<Record<string, SyntaxNodeWriter>>;
export declare const directiveMarkWriters: Readonly<Record<string, SyntaxMarkWriter>>;
/**
 * Escapes a `:` followed by a registered directive name as `\:`. This protects text for as long as directives are **read**.
 * Left as is, it would be read as a directive on re-parse (`:u[`, `::image` etc.). Unregistered names (`:free를`) and
 * colons in times and URLs (`12:30`, `https://`) are left alone. An already escaped `\:` is kept.
 */
export declare const escapeDirectiveColon: (text: string, context: SerializeContext) => string;
/**
 * Text written by the directive writers: the colon escape, and inside a label made by a text directive `]` closes the label, so it is escaped too
 * (core handles it when the label is explicit).
 */
export declare const escapeDirectiveText: (text: string, context: SerializeContext) => string;
