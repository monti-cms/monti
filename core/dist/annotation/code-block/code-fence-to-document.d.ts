import type { AnnotationConfig, CodeBlockDocument, CodeFence } from "./types.js";
export declare const parseCodeFenceMeta: (meta: string) => CodeBlockDocument["meta"];
declare const parseAnnotationAttrs: (rest: string) => {
    name: string;
    value: unknown;
}[];
export declare const fromCodeFenceToCodeBlockDocument: (codeNode: CodeFence, annotationConfig: AnnotationConfig, options?: {
    parseLineAnnotations?: boolean;
    /** Called for each line annotation whose range reaches past the last code line (cut, or dropped when it starts past it). */
    onOutOfRange?: (annotation: {
        name: string;
        start: number;
        end: number;
    }) => void;
}) => CodeBlockDocument;
export declare const __testable__: {
    parseCodeFenceMeta: typeof parseCodeFenceMeta;
    parseAnnotationAttrs: typeof parseAnnotationAttrs;
    fromCodeFenceToCodeBlockDocument: typeof fromCodeFenceToCodeBlockDocument;
};
export {};
