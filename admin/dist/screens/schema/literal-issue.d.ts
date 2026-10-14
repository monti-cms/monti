import type { SchemaLiteralIssue } from "@monti-cms/core/schema-edit";
import type { TranslatorFor } from "../../translator.js";
import type { schemaMessages } from "./messages.js";
type T = TranslatorFor<typeof schemaMessages>;
/**
 * The sentence for what is wrong in a schema file that holds code: the issue's code, with the names it mentions, and the line. The server also sends the English
 * sentence (`detail`), which the command line shows; the screen shows this one in the admin language.
 */
export declare function describeLiteralIssue(t: T, issue: SchemaLiteralIssue): string;
export {};
