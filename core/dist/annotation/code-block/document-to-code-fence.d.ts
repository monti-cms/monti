import type { Code } from "mdast";
import { type CommentSyntax } from "./comment-syntax.js";
import type { AnnotationAttr, AnnotationConfig, CodeBlockDocument, CodeBlockRule } from "./types.js";
declare const fromLineValueToLeadingIndent: (lineValue: string) => string;
declare const fromDocumentMetaToCodeFenceMeta: (meta: CodeBlockDocument["meta"]) => string;
declare const fromAnnotationToCommentLine: (commentSyntax: CommentSyntax, annotation: {
    scope: "char" | "line" | "document";
    name: string;
    range: {
        start: number;
        end: number;
    };
    attributes?: AnnotationAttr[];
}) => string;
/** A regex rule is written as the rule itself (`{re:/.../flags}`), not as the ranges it found. */
declare const fromRuleToCommentLine: (commentSyntax: CommentSyntax, rule: CodeBlockRule) => string;
export declare const fromCodeBlockDocumentToCodeFence: (document: CodeBlockDocument, annotationConfig: AnnotationConfig) => Code;
export declare const __testable__: {
    fromLineValueToLeadingIndent: typeof fromLineValueToLeadingIndent;
    fromDocumentMetaToCodeFenceMeta: typeof fromDocumentMetaToCodeFenceMeta;
    fromAnnotationToCommentLine: typeof fromAnnotationToCommentLine;
    fromRuleToCommentLine: typeof fromRuleToCommentLine;
    fromCodeBlockDocumentToCodeFence: typeof fromCodeBlockDocumentToCodeFence;
};
export {};
