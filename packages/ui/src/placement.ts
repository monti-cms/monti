import { type CSSProperties, useMemo, useSyncExternalStore } from "react";
import { dockShown, dockTopShown, watchDock } from "./bottom-dock";

/**
 * Where floating things stand (overlay.md, the place rule). Four kinds:
 *
 * - Things that stay while a person edits (a block's tool row, a table's grips and + strips, the block handle) cover no text. They reserve their room
 *   (`TOOL_ROW_ROOM`) and stand at their edge (`Anchored`).
 * - Things a person opens (menus, the "/" menu, cards, the format card) may cover text while open, but sit on what opened them: aligned to its edge,
 *   never narrower than it, folded inside the body across and the window up and down, and shrunk to scroll before they flip (`FIT_HEIGHT`).
 * - Bars fixed to the window's edge (the editor header, the review bar): words scroll under them and every word can be scrolled clear of them, the body
 *   keeping an end room of the bar's height and gap.
 * - What lives in a block's node view (a block's tool row) is placed by CSS on its block.
 *
 * The numbers and the defaults are here once; no part picks its own.
 */

/**
 * The room a block with a tool row keeps above it, always (not only while the row shows, so nothing jumps when it comes): the row's height and
 * its gap. The row is 28px buttons with 3px inside and a 1px border (36px), and 8px stand between the row and the block: 44px. A block under a paragraph
 * (20px below) then stands 44px from it, and the row never covers the paragraph's last line. A block keeps it where a row can appear (the body is
 * written, or a picked picture of a read-only body has its settings), the same whether the row shows or not, so nothing jumps.
 */
export const TOOL_ROW_ROOM = "mt-[44px]";

/**
 * The same, for a block whose own tools stand on its top edge (the columns' grips: 12px tall and 4px off): the tool row stands above that lane, 16px
 * higher, so the two never meet whatever the columns' widths are. 36 + 8 + 16.
 */
export const TOOL_ROW_ROOM_LANE = "mt-[60px]";

/** The gap between a thing at a block's or a table's edge and the edge (px): the block handle, a table's grips. */
export const EDGE_GAP = 4;

/** The least height (px) a menu may shrink to before it flips to the other side. */
export const MIN_MENU_HEIGHT = 160;

/**
 * A menu's height: what is left on its side (Base UI's `--available-height`, less 2px so the flip check, which has 1px more padding than the
 * shrink, still finds it fitting), and never under {@link MIN_MENU_HEIGHT}. With room for the minimum the menu shrinks and scrolls on its side; only
 * when the room is less than the minimum is it taller than the room, and Base UI flips it. `FIRST_PASS` makes the first pass ask for the minimum only.
 */
export const FIT_HEIGHT = "max-h-[max(160px,calc(var(--available-height)-2px))]";

/**
 * The list inside a searchable card (a combobox): at most 252px, the room left less the card's own 36px (the search row, its margin and padding), and
 * not under the card's minimum less the same, so a list shrinks to scroll before its card flips.
 */
export const FIT_LIST = "max-h-[max(124px,min(252px,calc(var(--available-height)-38px)))]";

/**
 * The positioner's first pass (Base UI seeds `--available-height` with `100vh`, so a menu is measured at its full height and flips when that does not
 * fit). Seeded with the minimum instead, the first pass asks only for room for the minimum; Base UI then writes the real room and the menu grows to it
 * (`FIT_HEIGHT`). Put it on the positioner's `style`.
 */
export const FIRST_PASS = { "--available-height": `${MIN_MENU_HEIGHT}px` } as CSSProperties;

/** How far a floating thing stays from the window's edges (px). */
export const WINDOW_PADDING = 8;

/**
 * The room a bar fixed to the window's edge takes, in px from that edge: the review bar's height and the 12px it stands over the edge, or the editor
 * header's whole height (it ends where the box that scrolls begins). Both are read here, so what opens in the body leaves each clear by one rule.
 */
function barRoom(bar: HTMLElement | null, edge: "top" | "bottom") {
	if (!bar) return 0;
	if (edge === "top") return Math.max(0, Math.ceil(bar.getBoundingClientRect().bottom));
	const held = bar.firstElementChild;
	return held instanceof HTMLElement ? held.offsetHeight + 24 : 0;
}

/**
 * The collision padding every floating thing takes (px, per edge): the window padding, and over the bars fixed to the window's edges their room
 * (AS-14: a card never covers the review bar, and nothing opened in the body covers the editor header). The same object while the numbers are the
 * same, so the positioner does not start measuring again.
 */
export function usePlacementPadding() {
	const docked = useSyncExternalStore(watchDock, dockShown, () => null);
	const header = useSyncExternalStore(watchDock, dockTopShown, () => null);
	const bottom = barRoom(docked, "bottom");
	const top = barRoom(header, "top");
	return useMemo(
		() => ({
			top: Math.max(WINDOW_PADDING, top + (top ? WINDOW_PADDING : 0)),
			left: WINDOW_PADDING,
			right: WINDOW_PADDING,
			bottom: Math.max(WINDOW_PADDING, bottom + WINDOW_PADDING),
		}),
		[top, bottom],
	);
}

/**
 * How a placed thing meets an edge. `stays`: flips to the other side and slides along (a thing opened: the format card, a thing beside the pointer). `exact`: stays where it is told (a handle,
 * a grip, a drawn line or box): it is not flipped onto text either, and a thing whose anchor has scrolled out of view is hidden (`Anchored`).
 */
export const COLLISION = {
	stays: { side: "flip", align: "shift" },
	exact: { side: "none", align: "none" },
} as const;

type Size = { width: number; height: number };
type Offset = number | ((data: { anchor: Size; positioner: Size }) => number);
type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/** The named places of what stays (the `placement` of `Anchored`): which side of what it stands for, aligned how, and how far off. */
export const PLACES: Record<
	"block-left" | "selection-above" | "table-above" | "table-left" | "over-box" | "beside-point",
	{ side: Side; align: Align; sideOffset: Offset; alignOffset?: number; collision: keyof typeof COLLISION }
> = {
	/** The block handle: in the left margin, level with the block's first line, {@link EDGE_GAP} off the text. */
	"block-left": { side: "left", align: "start", sideOffset: EDGE_GAP, collision: "exact" },
	/** The format card: over the selected words, 8px up, flipped below when there is no room above; it is a thing opened and goes with the selection. */
	"selection-above": { side: "top", align: "start", sideOffset: 8, collision: "stays" },
	/** A table's column grip: above the top edge, {@link EDGE_GAP} off, in the middle of the column. */
	"table-above": { side: "top", align: "center", sideOffset: EDGE_GAP, collision: "exact" },
	/** A table's row grip: out of the left rule by its own width and the gap, in the middle of the row. */
	"table-left": { side: "left", align: "center", sideOffset: EDGE_GAP, collision: "exact" },
	/** A thing laid exactly over the box it stands for (a drawn box, a line, a + strip, a border): the same corner as the box's. */
	"over-box": { side: "bottom", align: "start", sideOffset: ({ anchor }) => -anchor.height, collision: "exact" },
	/** A thing beside the pointer (the block in hand): to its right and a little below. */
	"beside-point": { side: "right", align: "start", sideOffset: 16, alignOffset: 8, collision: "stays" },
};

export type Place = keyof typeof PLACES;
