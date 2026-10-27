import { cva, type VariantProps } from "class-variance-authority";

/**
 * The options every layout part shares (Box, Stack, Inline, Grid): padding, a surface, a border, a radius, a size and how it grows, all by
 * token name. A screen arranges with these and never writes a class; anything they cannot say belongs in a component of its own.
 */
/** Written out in full so Tailwind finds every class in this file. */
export const LAYOUT = {
	padding: {
		none: "p-0",
		hair: "p-monti-2",
		tight: "p-monti-4",
		condensed: "p-monti-8",
		normal: "p-monti-12",
		comfortable: "p-monti-16",
		spacious: "p-monti-24",
		wide: "p-monti-32",
		section: "p-monti-48",
	},
	paddingX: {
		none: "px-0",
		hair: "px-monti-2",
		tight: "px-monti-4",
		condensed: "px-monti-8",
		normal: "px-monti-12",
		comfortable: "px-monti-16",
		spacious: "px-monti-24",
		wide: "px-monti-32",
		section: "px-monti-48",
	},
	paddingY: {
		none: "py-0",
		hair: "py-monti-2",
		tight: "py-monti-4",
		condensed: "py-monti-8",
		normal: "py-monti-12",
		comfortable: "py-monti-16",
		spacious: "py-monti-24",
		wide: "py-monti-32",
		section: "py-monti-48",
	},
	paddingTop: {
		none: "pt-0",
		hair: "pt-monti-2",
		tight: "pt-monti-4",
		condensed: "pt-monti-8",
		normal: "pt-monti-12",
		comfortable: "pt-monti-16",
		spacious: "pt-monti-24",
		wide: "pt-monti-32",
		section: "pt-monti-48",
	},
	paddingBottom: {
		none: "pb-0",
		hair: "pb-monti-2",
		tight: "pb-monti-4",
		condensed: "pb-monti-8",
		normal: "pb-monti-12",
		comfortable: "pb-monti-16",
		spacious: "pb-monti-24",
		wide: "pb-monti-32",
		section: "pb-monti-48",
	},
	background: {
		page: "bg-monti-page",
		surface: "bg-monti-page",
		inset: "bg-monti-tool",
		overlay: "bg-monti-page",
		neutral: "bg-monti-muted",
		selected: "bg-monti-selected",
		"accent-muted": "bg-monti-selected",
		"danger-muted": "bg-monti-danger-muted",
		"warning-muted": "bg-monti-warning-muted",
		"success-muted": "bg-monti-success-muted",
	},
	/** A hairline on every side, or on one; `default` is the stronger line of a control. */
	border: {
		all: "border border-monti-muted",
		top: "border-t border-monti-muted",
		bottom: "border-b border-monti-muted",
		"bottom-strong": "border-b-[1.5px] border-monti-contrast",
		left: "border-l border-monti-muted",
		right: "border-r border-monti-muted",
		y: "border-y border-monti-muted",
		x: "border-x border-monti-muted",
		default: "border border-monti-default",
		danger: "border border-monti-danger/40",
		dashed: "border border-dashed border-monti-default",
	},
	/** A 1px hairline between each child in a column. */
	divided: { true: "divide-y divide-monti-muted" },
	radius: {
		sm: "rounded-monti-sm",
		md: "rounded-monti-md",
		lg: "rounded-monti-lg",
		xl: "rounded-monti-xl",
		full: "rounded-monti-full",
	},
	width: {
		full: "w-full",
		auto: "w-auto",
		fit: "w-fit",
		"panel-sm": "w-monti-menu",
		panel: "w-monti-panel",
		"panel-lg": "w-monti-assistant",
		sidebar: "w-monti-sidebar",
	},
	maxWidth: {
		full: "max-w-full",
		"panel-sm": "max-w-monti-menu",
		panel: "max-w-monti-panel",
		"panel-lg": "max-w-monti-assistant",
		prose: "max-w-prose",
		content: "max-w-monti-content",
		page: "max-w-monti-content",
		/** A detail pane's readable column (768px). */
		detail: "max-w-3xl",
	},
	/** `0` lets a flex child shrink below its content (long text truncates instead of pushing the row wider). */
	minWidth: { 0: "min-w-0" },
	height: {
		full: "h-full",
		auto: "h-auto",
		screen: "h-svh",
		control: "h-monti-icon",
		"control-sm": "h-monti-control-sm",
		header: "h-monti-header",
	},
	/** A scrolling area's limit: `list` 384px (a list in a card or dialog), `half` half the window, `menu` 320px. Pair with `overflow="y"`. */
	maxHeight: { list: "max-h-96", half: "max-h-[50vh]", menu: "max-h-80" },
	minHeight: { 0: "min-h-0", full: "min-h-full", screen: "min-h-svh", empty: "min-h-64", header: "min-h-monti-header" },
	grow: { true: "flex-1" },
	shrink: { false: "shrink-0" },
	/** `clip`: a frame the size of the window that nothing can scroll, not even a field brought into view (the panes inside scroll). */
	overflow: {
		auto: "overflow-auto",
		hidden: "overflow-hidden",
		clip: "overflow-clip",
		y: "overflow-y-auto",
		x: "overflow-x-auto",
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
