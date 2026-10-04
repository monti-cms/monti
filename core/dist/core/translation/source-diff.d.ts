import { type CmsNode } from "../../mdx/index.js";
export type UnitKind = "block" | "header";
export interface TranslationUnit {
    /** Matching key: ancestor box kind + unit kind + node kind. Only units with the same key are paired. */
    readonly key: string;
    readonly kind: UnitKind;
    /** Node kind (`paragraph`, `codeBlock`, `Callout` …). */
    readonly type: string;
    /** For a block, that node; for a header line, the box node. */
    readonly node: CmsNode;
    /** Source fragment. For a block it is MDX; for a header line it is the JSON of the translatable attributes. */
    readonly source: string;
    /** Nothing to translate, so the source is used as is (dividers, empty paragraphs, images without a description, etc.). */
    readonly auto: boolean;
}
/** Translated value of a header line. A box's translatable attributes (e.g. callout title) or values gathered from children (e.g. tab names). */
export type HeaderValue = {
    title: string;
} | {
    labels: string[];
};
/** Splits a source document into translation units (document order). */
export declare function flattenUnits(doc: CmsNode): TranslationUnit[];
/** Blocks changed in one source version, in document order. */
export type SourceChange = {
    readonly kind: "changed";
    readonly before: TranslationUnit;
    readonly after: TranslationUnit;
} | {
    readonly kind: "added";
    readonly after: TranslationUnit;
} | {
    readonly kind: "removed";
    readonly before: TranslationUnit;
};
/**
 * Compares two source versions block by block. Equal blocks are omitted; a block whose content alone changed at the same position (a pair with the same key) is
 * `changed`, a new block is `added`, and a removed block is `removed`. `null` if either cannot be parsed.
 */
export declare function diffSources(beforeMdx: string, afterMdx: string): SourceChange[] | null;
