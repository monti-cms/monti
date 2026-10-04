import { type RefObject } from "react";
/** Vertical position of a block on screen (viewport-relative). */
export interface BlockBox {
    readonly top: number;
    readonly bottom: number;
}
/** Marker name attached to the block under the cursor in the source pane. */
export declare const ACTIVE_BLOCK_CLASS = "cms-source-active";
/**
 * Translation editor block -> source block order. Pairs blocks of the same kind from the top using the longest common subsequence.
 * An unpaired block (e.g. when translation splits a list in two) attaches to the previous pair's source block, so later blocks do not shift.
 */
export declare function alignBlocks(editorKinds: readonly string[], paneKinds: readonly string[]): number[];
/**
 * The scrollTop that puts the same block as the one at the translation editor's baseline (just below the toolbar) at the source pane's baseline.
 * Blocks correspond through `map` (editor order -> source order). If absent, the same order (the last block if the source is shorter).
 * If the baseline is above the first block (title area), keep that gap and align the first block position. `null` if there is no block to align.
 */
export declare function syncOffset({ editorBlocks, editorLine, paneBlocks, paneLine, paneScrollTop, map, }: {
    editorBlocks: readonly BlockBox[];
    editorLine: number;
    paneBlocks: readonly BlockBox[];
    paneLine: number;
    paneScrollTop: number;
    map?: readonly number[];
}): number | null;
export declare const blocksOf: (root: Element | null | undefined) => HTMLElement[];
/** Order of the top-level block containing `node`. `null` if outside the editor. */
export declare const blockIndexOf: (root: Element, node: Node | null) => number | null;
/** Block kind. For React node views, the node name (`node-cmsCallout`); otherwise the tag name. */
export declare const blockKind: (element: Element) => string;
/** Order of the list item containing `node` (from the outermost list). Empty array if outside a list. */
export declare function itemPathOf(block: Element, node: Node): number[];
/** The list item at the same order in the source block. If none, as far as found (the block itself). */
export declare function itemAt(block: Element, path: readonly number[]): Element;
/**
 * Links the translation editor and the source pane. When the editor scrolls, moves the source pane so the same block is at the same height
 * (the reverse direction is not linked), and marks the source block matching the block under the editor cursor. Lists are marked per item.
 */
export declare function useSourceSync({ enabled, syncScroll, editorRef, paneRef, }: {
    enabled: boolean;
    syncScroll: boolean;
    editorRef: RefObject<HTMLElement | null>;
    paneRef: RefObject<HTMLElement | null>;
}): void;
