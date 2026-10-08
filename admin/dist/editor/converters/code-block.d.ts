import type { Site } from "@monti-cms/core/client";
import { type CodeLineEffect, type CodeRule, type CodeSpan } from "@monti-cms/core/code-block";
import type { CmsJsonValue, CmsNode } from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";
import type { BlockConverter } from "./types.js";
/** The fence text of a stored code block: its code with the annotations written as Monti annotation comments. This is the model the code editor works on. */
export declare const codeFenceOf: (site: Site, node: CmsNode) => string;
/** The stored attributes of a code block from the editor's fence text (`language`, `meta`, and the value with its annotation comments). */
export declare const storedCodeAttrs: (site: Site, language: string | null, meta: string | null, value: string) => Record<string, CmsJsonValue>;
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
export declare function parseCodeFence(site: Site, value: string, language: string | null, meta: string | null): ParsedCodeFence | null;
/** Writes the editor model as a code fence value (including comment lines). */
export declare function serializeCodeFence(site: Site, model: ParsedCodeFence, language: string | null): string;
export declare const codeBlockConverter: BlockConverter;
