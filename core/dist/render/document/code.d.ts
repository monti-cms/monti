import type { Element } from "hast";
import { type ComponentType, type ReactNode } from "react";
import type { CmsNode } from "../../doc/types.js";
import type { Site } from "../../site/index.js";
import { type CodeHighlightOptions, type HighlightFn, type HighlightSite } from "../code/index.js";
import type { StoredCodeAnnotations } from "./types.js";
/**
 * Code blocks of a stored document: the stored code and annotations go through the same Shiki pipeline the MDX chain used (annotation payload → `highlight`),
 * and the highlighted `<pre>` becomes React elements with `hast-util-to-jsx-runtime`. No data is smuggled through element attributes.
 */
export interface HighlightedCode {
    /** The `<pre>` element, with only the properties Shiki sets (and the line number flag). */
    readonly pre: Element;
    /** Descriptions of the tooltips inside the code, in number order. */
    readonly notes: readonly string[];
    readonly showLineNumbers: boolean;
    readonly title?: string;
    readonly code: string;
    readonly language: string;
}
/** The function that highlights for the given code options: theirs, one built from their languages and themes, or the site's. */
export declare const highlighterFor: (site: HighlightSite, options: CodeHighlightOptions | undefined) => Promise<HighlightFn> | HighlightFn;
/** The language, code, title and annotations a stored code block holds, as plain values. */
export declare const readCodeBlock: (node: CmsNode) => {
    language: string;
    code: string;
    meta: string;
    /** The file name (`title="src/a.ts"` in the fence meta). */
    title: string | undefined;
    annotations: StoredCodeAnnotations;
};
/** Highlights one stored code block. It never throws: code that cannot be annotated or highlighted is shown as plain text. */
export declare const highlightCodeBlock: (site: Pick<Site, "annotationConfig">, node: CmsNode, highlight: HighlightFn, options: CodeHighlightOptions | undefined) => {
    code: string;
    language: string;
    showLineNumbers: boolean;
    title?: string | undefined;
    pre: Element;
    notes: string[];
};
/** Elements in the highlighted code that a component draws (`fold`, `collapse`, `Tooltip`, ...): the tag → component table. */
export type CodeTags = Readonly<Record<string, ComponentType<{
    readonly children?: ReactNode;
}>>>;
/** The highlighted `<pre>` as React elements. A render tag without a component shows its text. */
export declare const codePreElement: (site: Pick<Site, "annotationConfig">, pre: Element, tags: CodeTags) => ReactNode;
