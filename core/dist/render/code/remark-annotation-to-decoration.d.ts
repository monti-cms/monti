import type { Root } from "mdast";
import type { DecorationItem } from "shiki";
import type { AnnotationConfig, AnnotationRegistry, CodeBlockAnnotation, CodeBlockDocument, LineAnnotation } from "../../code-block.js";
type ResolvedAnnotationStyle = {
    class?: string;
    render?: string;
};
declare const resolveStyleFromRule: (registry: AnnotationRegistry | undefined, annotation: Pick<CodeBlockAnnotation, "name" | "scope">) => ResolvedAnnotationStyle | undefined;
declare const toLineDecorationPayload: (annotation: LineAnnotation, style: ResolvedAnnotationStyle | undefined) => {
    scope: "line";
    name: string;
    range: import("../../code-block.js").Range;
    order: number;
    class: string;
    attributes: import("../../code-block.js").AnnotationAttr[];
} | undefined;
declare const toLineWrapperPayload: (annotation: LineAnnotation, style: ResolvedAnnotationStyle | undefined) => {
    scope: "line";
    name: string;
    range: import("../../code-block.js").Range;
    order: number;
    render: string;
    attributes: import("../../code-block.js").AnnotationAttr[];
} | undefined;
export type LineDecorationPayload = ReturnType<typeof toLineDecorationPayload> extends infer T ? Exclude<T, undefined> : never;
export type LineWrapperPayload = ReturnType<typeof toLineWrapperPayload> extends infer T ? Exclude<T, undefined> : never;
export type ShikiAnnotationPayload = {
    code: string;
    lang: CodeBlockDocument["lang"];
    meta: CodeBlockDocument["meta"];
    decorations: DecorationItem[];
    lineDecorations: LineDecorationPayload[];
    rowWrappers: LineWrapperPayload[];
};
export declare const fromCodeBlockDocumentToShikiAnnotationPayload: (document: CodeBlockDocument, annotationConfig?: AnnotationConfig) => ShikiAnnotationPayload;
export declare function remarkAnnotationToShikiDecoration(annotationConfig: AnnotationConfig): (tree: Root) => void;
export declare const __testable__: {
    fromCodeBlockDocumentToShikiAnnotationPayload: typeof fromCodeBlockDocumentToShikiAnnotationPayload;
    resolveStyleFromRule: typeof resolveStyleFromRule;
};
export {};
