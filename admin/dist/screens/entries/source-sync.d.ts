import type { Node as PmNode } from "@tiptap/pm/model";
/**
 * The translation screen's source column follows the block being written. Blocks of the translation are paired with blocks of the source by the
 * link each translation block stores (`sourceBlockId`, the id of the source block it was made from), and by kind for blocks without a matching
 * link. The source block paired with the block under the cursor is moved to the same height as that block (top edges aligned), and both are
 * marked. Without a cursor in the body, or while the translation is only scrolled, the source follows the translation's middle line instead.
 *
 * Inside a box whose body is blocks (a callout, a collapsible, a quote, nested ones too) pairing and anchoring go down to the innermost
 * paired block; a box itself stays one block on each side. Lists and tables are paired and anchored as a whole.
 */
/** Vertical position of a block on screen (viewport-relative). */
export interface BlockBox {
    readonly top: number;
    readonly bottom: number;
}
/** One block of a body as the sync sees it. */
export interface SyncBlock {
    /** Block id (`blockId`). */
    readonly id: string | null;
    /** In a translation, the id of the source block this block was made from (`sourceBlockId`). */
    readonly sourceId: string | null;
    /** Node name: what blocks without a matching link are paired by. */
    readonly kind: string;
    /** Position of the block in its document. */
    readonly pos: number;
    readonly size: number;
    /** The blocks inside a box whose body is blocks, which are paired and anchored on their own. `null` for any other block. */
    readonly children: readonly SyncBlock[] | null;
}
/** Marker class of the paired blocks the sync anchors on, in both columns. */
export declare const ACTIVE_BLOCK_CLASS = "monti-source-active";
/**
 * How a column shows its marked block: only a faint background spread around it, with no bar (a shadow spread, so it does not shift layout and
 * also wraps list bullets).
 */
export declare const ACTIVE_BLOCK_STYLE = "[&_.monti-source-active]:rounded-sm [&_.monti-source-active]:bg-monti-primary/8 [&_.monti-source-active]:shadow-[0_0_0_12px_color-mix(in_oklab,var(--color-monti-primary)_8%,transparent)] [&_.monti-source-active]:transition-[background-color,box-shadow]";
/** Attribute the sync puts on the body of a source box whose paired translation box is collapsed. */
export declare const SOURCE_COLLAPSED_ATTRIBUTE = "data-source-collapsed";
/** The blocks of a document (`start` is the position its content starts at), with the blocks inside boxes whose body is blocks. */
export declare function syncBlocksOf(parent: PmNode, start?: number): SyncBlock[];
/**
 * Pairs each translation block with at most one source block:
 * 1. by link, at any depth: a translation block whose `sourceId` is the id of a source block (the first block that claims it);
 * 2. the rest by kind, among the blocks of the same level of two paired boxes (or the two documents), and only between blocks that are
 *    paired in order, so a block added between two linked blocks (a split, a new paragraph) stays unpaired rather than taking a later one.
 */
export declare function pairSyncBlocks(translation: readonly SyncBlock[], source: readonly SyncBlock[]): Map<SyncBlock, SyncBlock>;
/** The blocks holding `pos`, from the outermost to the innermost (inside boxes whose body is blocks). */
export declare function blockPathAt(blocks: readonly SyncBlock[], pos: number): SyncBlock[];
/** One translation block and its source block, on screen. `inner` gives the pairs inside them, for boxes whose body is blocks. */
export interface PairBox {
    readonly translation: BlockBox;
    readonly source: BlockBox;
    readonly inner?: () => readonly PairBox[];
}
/**
 * Where on screen the source point matching the translation's `line` is, for the pairs of one level in translation order (the innermost pair
 * holding the line decides). Within a block, the same fraction of the paired source block; above or below a block, the same distance from its
 * edge. `null` without pairs.
 */
export declare function sourceLineAt(pairs: readonly PairBox[], line: number): number | null;
/** A source box shows its body as its paired translation box does: collapsed when that one is collapsed. Open state is view state only. */
export declare function followCollapsed(translationView: Element, sourceView: Element): void;
/**
 * Links the translation editor (inside `editor`, its scrolling element) to the source column (`pane`, its scrolling element).
 * See the top of this file. The source column is never scrolled back into the translation.
 */
export declare function useSourceSync({ enabled, syncScroll, editor: scroller, pane, }: {
    enabled: boolean;
    syncScroll: boolean;
    editor: HTMLElement | null;
    pane: HTMLElement | null;
}): void;
