import { type CodeLineEffect, type CodeRule, type CodeSpan } from "@monti-cms/core/code-block";
import type { JSONContent } from "@tiptap/core";
import type { BlockConverter } from "./types.js";
/** Reads char effect ranges from Tiptap code block content (text with marks). */
export declare function spansFromContent(content: JSONContent[] | undefined): CodeSpan[];
export interface ParsedCodeFence {
    text: string;
    spans: CodeSpan[];
    lineEffects: CodeLineEffect[];
    rules: CodeRule[];
}
/**
 * Reads a code fence value (including comment lines) into the editor model.
 * null if there are comments the editor cannot represent (unknown line effects, the same effect overlapping with different attributes) - opens in raw editing.
 */
export declare function parseCodeFence(value: string, language: string | null, meta: string | null): ParsedCodeFence | null;
/** Writes the editor model as a code fence value (including comment lines). */
export declare function serializeCodeFence(model: ParsedCodeFence, language: string | null): string;
export declare const codeBlockConverter: BlockConverter;
