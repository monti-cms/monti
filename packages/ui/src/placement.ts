import { type CSSProperties, useSyncExternalStore } from "react";
import { dockShown, watchDock } from "./bottom-dock";

/**
 * Where floating things stand (overlay.md, the place rule). Two kinds:
 *
 * - Things that stay while a person edits (the format card, a block's tool row, a table's grips and + strips, the block handle, the review bar)
 *   cover no text. They reserve their room (`TOOL_ROW_ROOM`, the review bar's end of the body) and fold inside the body box and the window
 *   (`Anchored`'s `within`).
 * - Things a person opens (menus, the "/" menu, cards) may cover text while open, but sit on what opened them: aligned to its edge, never narrower
 *   than it, and shrunk to scroll before they flip (`FIT_HEIGHT`).
 *
 * The numbers and the defaults are here once; no part picks its own.
 */

/** The tool row over a block: 28px buttons, 3px inside and a 1px border on each side, and 8px between the row and the block. */
export const TOOL_ROW_HEIGHT = 36;
export const TOOL_ROW_GAP = 8;

/**
 * The room a block with a tool row keeps above it, always (not only while the row shows, so nothing jumps when it comes): the row's height and
 * its gap. A block under a paragraph (20px below) then stands 44px from it, and the row never covers the paragraph's last line.
 */
export const TOOL_ROW_ROOM = "mt-[44px]";

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

/** What stands docked at the window's bottom (the review bar) is not covered by a card: the bottom padding takes its height. */
function dockRoom(docked: HTMLElement | null) {
	const held = docked?.firstElementChild;
	return held ? Math.max(0, Math.ceil(window.innerHeight - held.getBoundingClientRect().top)) : 0;
}

/**
 * The collision padding every floating thing takes (px, per edge): the window padding, and at the bottom the review bar's room while it is shown
 * (AS-14: a card never covers the bar).
 */
export function usePlacementPadding() {
	const docked = useSyncExternalStore(watchDock, dockShown, () => null);
	return {
		top: WINDOW_PADDING,
		left: WINDOW_PADDING,
		right: WINDOW_PADDING,
		bottom: Math.max(WINDOW_PADDING, dockRoom(docked) + WINDOW_PADDING),
	};
}

/** How a placed thing meets an edge: a thing that stays flips to the other side and slides along; a drawn line or box stays exactly where it is told. */
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
	"block-left": { side: "left", align: "start", sideOffset: EDGE_GAP, collision: "stays" },
	/** The format card: over the selected words, 8px up. */
	"selection-above": { side: "top", align: "center", sideOffset: 8, collision: "stays" },
	/** A table's column grip: above the top edge, {@link EDGE_GAP} off, in the middle of the column. */
	"table-above": { side: "top", align: "center", sideOffset: EDGE_GAP, collision: "stays" },
	/** A table's row grip: out of the left rule by its own width and the gap, in the middle of the row. */
	"table-left": { side: "left", align: "center", sideOffset: EDGE_GAP, collision: "stays" },
	/** A thing laid exactly over the box it stands for (a drawn box, a line, a + strip, a border): the same corner as the box's. */
	"over-box": { side: "bottom", align: "start", sideOffset: ({ anchor }) => -anchor.height, collision: "exact" },
	/** A thing beside the pointer (the block in hand): to its right and a little below. */
	"beside-point": { side: "right", align: "start", sideOffset: 16, alignOffset: 8, collision: "stays" },
};

export type Place = keyof typeof PLACES;
