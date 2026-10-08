import { type StoredDocument } from "../../doc/stored-document.js";
import type { CmsNode } from "../../doc/types.js";
import type { Site } from "../../site/index.js";
/**
 * Block comparison of two source versions (translation screen).
 *
 * Splits the source the translator last confirmed and the current source into blocks and finds changed, added and removed blocks.
 * Expandable boxes (`translateInside` in the block definition, e.g. callout, tabs, alignment) are expanded and their header line (translatable attributes) and inner blocks are each
 * compared. Used by both server and browser.
 *
 * Blocks are paired by block id (`TranslationUnit.node.id`) first, so an edited block stays the same block and a moved block shows as moved;
 * blocks without an id are paired by kind and content.
 */
/** What the comparison reads from the blocks of a site. */
type DiffSite = Pick<Site, "BLOCK_BY_NAME" | "FENCE_BLOCKS">;
export type UnitKind = "block" | "header";
export interface TranslationUnit {
    /** Matching key: ancestor box kind + unit kind + node kind. Only units with the same key are paired. */
    readonly key: string;
    readonly kind: UnitKind;
    /** Node kind (`paragraph`, `codeBlock`, `callout` …). */
    readonly type: string;
    /** For a block, that node; for a header line, the box node. */
    readonly node: CmsNode;
    /** Content of the unit, equal exactly when two units read the same: the JSON of the block (without block ids), or for a header line the JSON of the translatable attributes. */
    readonly source: string;
    /** Block id of the enclosing box (`undefined` at the top level or when the box has no id). */
    readonly parentId: string | undefined;
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
export declare function flattenUnits(site: DiffSite, doc: Pick<StoredDocument, "content">): TranslationUnit[];
/** Blocks changed in one source version, in document order. */
export type SourceChange = {
    readonly kind: "changed";
    readonly before: TranslationUnit;
    readonly after: TranslationUnit;
} | {
    readonly kind: "added";
    readonly after: TranslationUnit;
}
/** Only from a comparison by block id: the block (edited or not, see `edited`) sits elsewhere than before. */
 | {
    readonly kind: "moved";
    readonly before: TranslationUnit;
    readonly after: TranslationUnit;
    /** The block's own content changed as well. */
    readonly edited: boolean;
} | {
    readonly kind: "removed";
    readonly before: TranslationUnit;
};
/**
 * Compares two source versions block by block. Equal blocks are omitted; a block whose content alone changed is `changed`, a new block is `added`, and a removed
 * block is `removed`. Blocks are paired by block id, which also finds `moved` blocks (see `diffById`). `null` if either is not a document (an `unparsed` body).
 */
export declare function diffSources(site: DiffSite, before: StoredDocument, after: StoredDocument): SourceChange[] | null;
export {};
