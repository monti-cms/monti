/**
 * A fenced code block as a Markdown parser reads it: its language, its meta string and its code. It has the shape of an mdast `code` node, which is what
 * the MDX package gives; core itself parses no Markdown.
 */
export type CodeFence = {
    type: "code";
    lang?: string | null;
    meta?: string | null;
    value: string;
};
export type Range = {
    start: number;
    end: number;
};
export type AnnotationAttr = {
    name: string;
    value: unknown;
};
type AnnotationBase = {
    scope: AnnotationScope;
    name: string;
    range: Range;
    priority: number;
    order: number;
    class?: string;
    render?: string;
    attributes?: AnnotationAttr[];
};
export type InlineAnnotationSource = "mdast" | "mdx-text";
export type InlineAnnotation = AnnotationBase & {
    scope: "char" | "document";
    source: InlineAnnotationSource;
    /** If the range was found by a regex rule (`{re:/.../}`), the index of that rule in `CodeBlockDocument.rules`. */
    rule?: number;
};
export type LineAnnotation = AnnotationBase & {
    scope: "line";
};
export type CodeBlockAnnotation = InlineAnnotation | LineAnnotation;
export type AnnotationScope = "char" | "line" | "document";
export type AnnotationKind = "class" | "render";
export type AnnotationRegistryItem = {
    name: string;
    kind: AnnotationKind;
    class?: string;
    render?: string;
    source: InlineAnnotationSource;
    scopes: AnnotationScope[];
    priority: number;
};
export type AnnotationRegistry = Map<string, AnnotationRegistryItem>;
type ClassAnnotationConfigItem = {
    name: string;
    kind: "class";
    class: string;
    source?: InlineAnnotationSource;
    scopes?: AnnotationScope[];
};
type RenderAnnotationConfigItem = {
    name: string;
    kind: "render";
    render: string;
    source?: InlineAnnotationSource;
    scopes?: AnnotationScope[];
};
export type AnnotationConfigItem = ClassAnnotationConfigItem | RenderAnnotationConfigItem;
export interface AnnotationConfig {
    annotations?: AnnotationConfigItem[];
}
export type Line = {
    value: string;
    annotations: InlineAnnotation[];
};
export type CodeBlockMetaValue = string | boolean;
/**
 * An annotation rule that finds ranges by regex. On save, it is written as the rule itself, not as the found ranges (fixed positions).
 * - `char`: finds only on line `line` (put `// @char fold {re:/.../}` directly above that line).
 * - `document`: finds across the whole code.
 */
export type CodeBlockRule = {
    scope: "char" | "document";
    name: string;
    pattern: string;
    flags: string;
    line?: number;
    attributes: AnnotationAttr[];
};
export type CodeBlockDocument = {
    lang: string;
    meta: Record<string, CodeBlockMetaValue>;
    annotations: LineAnnotation[];
    lines: Array<Line>;
    rules?: CodeBlockRule[];
};
export {};
