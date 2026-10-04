import type { Code } from "mdast";
import type { AnnotationConfig, CodeBlockDocument } from "./types.js";
export declare const parseCodeFenceMeta: (meta: string) => CodeBlockDocument["meta"];
declare const parseAnnotationAttrs: (rest: string) => {
    name: string;
    value: unknown;
}[];
export declare const fromCodeFenceToCodeBlockDocument: (codeNode: Code, annotationConfig: AnnotationConfig, options?: {
    parseLineAnnotations?: boolean;
}) => CodeBlockDocument;
export declare const __testable__: {
    parseCodeFenceMeta: typeof parseCodeFenceMeta;
    parseAnnotationAttrs: typeof parseAnnotationAttrs;
    fromCodeFenceToCodeBlockDocument: typeof fromCodeFenceToCodeBlockDocument;
};
export {};
