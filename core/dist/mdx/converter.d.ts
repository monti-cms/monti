import type { CmsMdxError, CmsNode } from "./types.js";
export type SourceConversionResult = {
    type: "visual";
    document: CmsNode;
    originalSource: string;
} | {
    type: "error";
    source: string;
    errors: CmsMdxError[];
};
export declare const SourceConverter: {
    toVisual(source: string, name?: string): SourceConversionResult;
    toSource(state: {
        originalSource: string;
        document: CmsNode;
    }, hasDocumentChanged: boolean): string;
};
