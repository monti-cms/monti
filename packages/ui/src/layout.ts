import { cva, type VariantProps } from "class-variance-authority";

/**
 * The options every layout part shares (Box, Stack, Inline, Grid): padding, a surface, a border, a radius, a size and how it grows, all by
 * token name. A screen arranges with these and never writes a class; anything they cannot say belongs in a component of its own.
 */
/** Written out in full so Tailwind finds every class in this file. */
export const layoutVariants = cva("", {
	variants: {
		padding: {
			none: "p-0",
			hair: "p-hair",
			tight: "p-tight",
			condensed: "p-condensed",
			normal: "p-normal",
			comfortable: "p-comfortable",
			spacious: "p-spacious",
			wide: "p-wide",
			section: "p-section",
		},
		paddingX: {
			none: "px-0",
			hair: "px-hair",
			tight: "px-tight",
			condensed: "px-condensed",
			normal: "px-normal",
			comfortable: "px-comfortable",
			spacious: "px-spacious",
			wide: "px-wide",
			section: "px-section",
		},
		paddingY: {
			none: "py-0",
			hair: "py-hair",
			tight: "py-tight",
			condensed: "py-condensed",
			normal: "py-normal",
			comfortable: "py-comfortable",
			spacious: "py-spacious",
			wide: "py-wide",
			section: "py-section",
		},
		paddingTop: {
			none: "pt-0",
			hair: "pt-hair",
			tight: "pt-tight",
			condensed: "pt-condensed",
			normal: "pt-normal",
			comfortable: "pt-comfortable",
			spacious: "pt-spacious",
			wide: "pt-wide",
			section: "pt-section",
		},
		paddingBottom: {
			none: "pb-0",
			hair: "pb-hair",
			tight: "pb-tight",
			condensed: "pb-condensed",
			normal: "pb-normal",
			comfortable: "pb-comfortable",
			spacious: "pb-spacious",
			wide: "pb-wide",
			section: "pb-section",
		},
		background: {
			page: "bg-monti-page",
			surface: "bg-monti-surface",
			inset: "bg-monti-inset",
			overlay: "bg-monti-overlay",
			neutral: "bg-monti-neutral",
			selected: "bg-monti-selected",
			"accent-muted": "bg-monti-accent-muted",
			"danger-muted": "bg-monti-danger-muted",
			"warning-muted": "bg-monti-warning-muted",
			"success-muted": "bg-monti-success-muted",
		},
		/** A hairline on every side, or on one; `default` is the stronger line of a control. */
		border: {
			all: "border border-monti-muted",
			top: "border-t border-monti-muted",
			bottom: "border-b border-monti-muted",
			left: "border-l border-monti-muted",
			right: "border-r border-monti-muted",
			y: "border-y border-monti-muted",
			x: "border-x border-monti-muted",
			default: "border border-monti-default",
			danger: "border border-monti-danger-muted",
			dashed: "border border-dashed border-monti-default",
		},
		radius: { sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl", full: "rounded-full" },
		width: {
			full: "w-full",
			auto: "w-auto",
			fit: "w-fit",
			"panel-sm": "w-panel-sm",
			panel: "w-panel",
			"panel-lg": "w-panel-lg",
		},
		maxWidth: {
			full: "max-w-full",
			"panel-sm": "max-w-panel-sm",
			panel: "max-w-panel",
			"panel-lg": "max-w-panel-lg",
			prose: "max-w-prose",
			content: "max-w-content",
			page: "max-w-page",
			/** A detail pane's readable column (768px). */
			detail: "max-w-3xl",
		},
		/** `0` lets a flex child shrink below its content (long text truncates instead of pushing the row wider). */
		minWidth: { 0: "min-w-0" },
		height: { full: "h-full", auto: "h-auto", screen: "h-svh", control: "h-control", "control-sm": "h-control-sm" },
		/** A scrolling area's limit: `list` 384px (a list in a card or dialog), `half` half the window, `menu` 320px. Pair with `overflow="y"`. */
		maxHeight: { list: "max-h-96", half: "max-h-[50vh]", menu: "max-h-80" },
		minHeight: { 0: "min-h-0", full: "min-h-full", screen: "min-h-svh", empty: "min-h-64" },
		grow: { true: "flex-1" },
		shrink: { false: "shrink-0" },
		overflow: { auto: "overflow-auto", hidden: "overflow-hidden", y: "overflow-y-auto", x: "overflow-x-auto" },
		/** Hidden on narrow screens (below the breakpoint), or from the breakpoint up. */
		hideBelow: { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden" },
		hideFrom: { sm: "sm:hidden", md: "md:hidden", lg: "lg:hidden" },
		position: { relative: "relative", sticky: "sticky top-0 z-10" },
		/** Pinned to a corner of the nearest `position="relative"` parent (a badge or an action on a tile). */
		place: {
			"top-left": "absolute top-condensed left-condensed",
			"top-right": "absolute top-condensed right-condensed",
			"bottom-right": "absolute right-condensed bottom-condensed",
		},
		/** A row or item that reacts to the pointer. */
		hover: { true: "transition-colors hover:bg-monti-hover" },
		/** Inside a `Grid`: spans every column (a wide field in a two-column form). */
		span: { all: "col-span-full" },
		/** Out of date while new content loads, or not available: shown, but quieter. */
		dimmed: { true: "opacity-50 transition-opacity" },
		/** Centered in a wider parent (a detail pane's column under its list). */
		centered: { true: "mx-auto" },
		/** One of a run of bands: a hairline and space above every one but the first. */
		band: { true: "border-t border-monti-muted pt-wide first:border-t-0 first:pt-0" },
	},
});

export type LayoutProps = VariantProps<typeof layoutVariants>;

/** Splits the layout options from the rest of a component's props. */
export function splitLayout<P extends LayoutProps>(props: P): [LayoutProps, Omit<P, keyof LayoutProps>] {
	const {
		padding,
		paddingX,
		paddingY,
		paddingTop,
		paddingBottom,
		background,
		border,
		radius,
		width,
		maxWidth,
		minWidth,
		height,
		maxHeight,
		minHeight,
		grow,
		shrink,
		overflow,
		hideBelow,
		hideFrom,
		position,
		place,
		hover,
		span,
		dimmed,
		band,
		centered,
		...rest
	} = props;
	return [
		{
			padding,
			paddingX,
			paddingY,
			paddingTop,
			paddingBottom,
			background,
			border,
			radius,
			width,
			maxWidth,
			minWidth,
			height,
			maxHeight,
			minHeight,
			grow,
			shrink,
			overflow,
			hideBelow,
			hideFrom,
			position,
			place,
			hover,
			span,
			dimmed,
		},
		rest,
	];
}
