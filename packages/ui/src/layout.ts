import { cva, type VariantProps } from "class-variance-authority";
import {
	BACKGROUND,
	HEIGHT,
	MAX_WIDTH,
	MIN_HEIGHT,
	PADDING,
	PADDING_BOTTOM,
	PADDING_TOP,
	PADDING_X,
	PADDING_Y,
	RADIUS,
	WIDTH,
} from "./tokens.generated";

/**
 * The options every layout part shares (Box, Stack, Inline, Grid): padding, a surface, a border, a radius, a size and how it grows, all by
 * the design system's token names (`padding={16}`, `background="tool"`, `radius="lg"`, `width="sheet"`). A screen arranges with these and never
 * writes a class; anything they cannot say belongs in a component of its own.
 */
/** Every class is written out in full (here or in `tokens.generated.ts`) so Tailwind finds it. */
export const LAYOUT = {
	padding: PADDING,
	paddingX: PADDING_X,
	paddingY: PADDING_Y,
	paddingTop: PADDING_TOP,
	paddingBottom: PADDING_BOTTOM,
	background: BACKGROUND,
	/** A hairline on every side, or on one; `bottom-contrast` is the ink rule under a page title (1px, the design system's `border-contrast`). */
	border: {
		all: "border border-monti-muted",
		top: "border-t border-monti-muted",
		bottom: "border-b border-monti-muted",
		"bottom-contrast": "border-b border-monti-contrast",
		left: "border-l border-monti-muted",
		right: "border-r border-monti-muted",
		y: "border-y border-monti-muted",
		x: "border-x border-monti-muted",
		danger: "border border-monti-danger/40",
		dashed: "border border-dashed border-monti-default",
	},
	/** A 1px hairline between each child in a column. */
	divided: { true: "divide-y divide-monti-muted" },
	radius: RADIUS,
	/** `full`, `auto` and `fit` are sizes of their own; the rest are the width tokens. */
	width: { full: "w-full", auto: "w-auto", fit: "w-fit", ...WIDTH },
	maxWidth: { full: "max-w-full", ...MAX_WIDTH },
	/** `0` lets a flex child shrink below its content (long text truncates instead of pushing the row wider). */
	minWidth: { 0: "min-w-0" },
	/** `full`, `auto` and `screen` are sizes of their own; the rest are the height tokens. */
	height: { full: "h-full", auto: "h-auto", screen: "h-svh", ...HEIGHT },
	/** A scrolling area's limit: `list` 384px (a list in a card or dialog), `half` half the window, `menu` 320px. Pair with `overflow="y"`. */
	maxHeight: { list: "max-h-96", half: "max-h-[50vh]", menu: "max-h-80" },
	minHeight: { 0: "min-h-0", full: "min-h-full", screen: "min-h-svh", empty: "min-h-64", ...MIN_HEIGHT },
	grow: { true: "flex-1" },
	shrink: { false: "shrink-0" },
	/**
	 * `clip`: a frame the size of the window that nothing can scroll, not even a field brought into view (the panes inside scroll). A scrolling box (`auto`, `y`,
	 * `x`) is `relative`: the screen-reader-only inputs inside it (a radio, a combobox) are placed in the box and scroll with it, instead of in the page around it,
	 * where they would stretch the page past its window.
	 */
	overflow: {
		auto: "relative overflow-auto",
		hidden: "overflow-hidden",
		clip: "overflow-clip",
		y: "relative overflow-y-auto",
		x: "relative overflow-x-auto",
	},
	/** Hidden on narrow screens (below the breakpoint), or from the breakpoint up. */
	hideBelow: { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden" },
	/**
	 * Hidden when the nearest `container` is narrower than this: `xl` 576px, `2xl` 672px. For a part of a header that goes when the page has less room, whatever
	 * the window is (a panel beside the page takes room the window does not lose).
	 */
	hideBelowContainer: { xl: "@max-xl:hidden", "2xl": "@max-2xl:hidden" },
	/** Makes this box the one `hideBelowContainer` measures: its own width, not the window's. */
	container: { true: "@container" },
	hideFrom: { sm: "sm:hidden", md: "md:hidden", lg: "lg:hidden" },
	position: { relative: "relative", sticky: "sticky top-0 z-10" },
	/** Pinned to a corner of the nearest `position="relative"` parent (a badge or an action on a tile). */
	place: {
		"top-left": "absolute top-monti-8 left-monti-8",
		"top-right": "absolute top-monti-8 right-monti-8",
		"bottom-right": "absolute right-monti-8 bottom-monti-8",
	},
	/** A row or item that reacts to the pointer. */
	hover: { true: "transition-colors hover:bg-monti-selected" },
	/** Inside a `Grid`: spans every column (a wide field in a two-column form). */
	span: { all: "col-span-full" },
	/** Out of date while new content loads, or not available: shown, but quieter. */
	dimmed: { true: "opacity-50 transition-opacity" },
	/** Centered in a wider parent (a detail pane's column under its list). */
	centered: { true: "mx-auto" },
	/** One of a run of bands: a hairline and space above every one but the first. */
	band: { true: "border-t border-monti-muted pt-monti-32 first:border-t-0 first:pt-0" },
} as const;

export const layoutVariants = cva("", { variants: LAYOUT });

export type LayoutProps = VariantProps<typeof layoutVariants>;

const LAYOUT_KEYS = Object.keys(LAYOUT) as (keyof LayoutProps)[];

/** Splits the layout options from the rest of a component's props. Every option of `LAYOUT` is taken, so a new one needs no second list. */
export function splitLayout<P extends LayoutProps>(props: P): [LayoutProps, Omit<P, keyof LayoutProps>] {
	const layout: Record<string, unknown> = {};
	const rest: Record<string, unknown> = { ...props };
	for (const key of LAYOUT_KEYS) {
		layout[key] = rest[key];
		delete rest[key];
	}
	return [layout as LayoutProps, rest as Omit<P, keyof LayoutProps>];
}
