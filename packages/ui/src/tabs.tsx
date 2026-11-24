"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { Count } from "./count";
import { HIT_AREA } from "./hit-area";

function Tabs({
	className,
	fill = false,
	...props
}: TabsPrimitive.Root.Props & {
	/** Takes the height left on the page, with no gap under the tab bar (a screen whose tabs are its sections). */
	fill?: boolean;
}) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			className={cn("group/tabs flex flex-col", fill ? "min-h-0 flex-1 gap-0" : "gap-monti-8", className)}
			{...props}
		/>
	);
}

/** The side padding of a bar, so its first tab lines up with the content's side padding. */
const BAR_INSET = { page: "px-monti-32", panel: "px-monti-24", none: "" } as const;

/**
 * The list of tabs: switches the view in the same place (language, status, a screen's sections, a panel's parts).
 * - `line` (default): underlined tabs, 13px 500 in `fg-subtle`, the picked one in ink with a 2px ink rule.
 * - `bar`: the tab row at the top of a pane, 48px with a rule under it that the picked tab's underline sits on; `inset` lines its first tab
 *   up with the content's side padding.
 * - `toolbar`: the tabs under a page title, in the filter row: 14px, the picked one bold, no underline (the title's rule is the only heavy line).
 */
function TabsList({
	className,
	variant = "line",
	inset = "panel",
	...props
}: TabsPrimitive.List.Props & {
	variant?: "line" | "bar" | "toolbar";
	inset?: keyof typeof BAR_INSET;
}) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(
				"group/tabs-list flex w-fit gap-monti-20 text-monti-label",
				variant === "line" && "items-end",
				variant === "toolbar" && "items-baseline text-monti-body",
				variant === "bar" &&
					cn("h-monti-panebar w-full shrink-0 items-end justify-start border-monti-default border-b", BAR_INSET[inset]),
				className,
			)}
			{...props}
		/>
	);
}

/** The look of one tab, shared by the tab of a tab list and the link of a link list. */
const TAB = `${HIT_AREA} inline-flex cursor-pointer items-baseline gap-monti-4 whitespace-nowrap border-0 border-transparent border-b-2 bg-transparent px-0 pt-monti-4 pb-monti-2 text-monti-subtle no-underline outline-none transition-colors not-disabled:hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/60 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-[current=page]:cursor-default data-active:border-monti-contrast data-active:font-medium data-active:text-monti-default [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:self-center group-data-[variant=toolbar]/tabs-list:border-b-0 group-data-[variant=toolbar]/tabs-list:p-0 group-data-[variant=toolbar]/tabs-list:data-active:font-bold group-data-[variant=bar]/tabs-list:-mb-px group-data-[variant=bar]/tabs-list:items-center group-data-[variant=bar]/tabs-list:gap-monti-6 group-data-[variant=bar]/tabs-list:pb-monti-12 group-data-[variant=page]/tabs-list:-mb-px group-data-[variant=page]/tabs-list:items-center group-data-[variant=page]/tabs-list:p-0 group-data-[variant=page]/tabs-list:font-medium group-data-[variant=entry]/tabs-list:-mb-px group-data-[variant=entry]/tabs-list:items-center group-data-[variant=entry]/tabs-list:p-0 group-data-[variant=entry]/tabs-list:font-medium`;

type TabExtras = {
	count?: React.ReactNode;
	/** `warning` for a count that needs attention (failed deliveries). */
	countTone?: "default" | "warning";
	/** What the count means, for screen readers ("3 failed deliveries"). */
	countLabel?: string;
	dot?: "warning" | "proposal";
	dotLabel?: string;
};

/** What follows a tab's name: its count and its change dot. */
function TabTail({ count, countTone, countLabel, dot, dotLabel }: TabExtras) {
	return (
		<>
			{count !== undefined && (
				<Count tone={countTone} aria-label={countLabel}>
					{count}
				</Count>
			)}
			{dot && (
				<ChangeDot
					tone={dot}
					label={dotLabel}
					className="ml-monti-2 self-center group-data-[variant=bar]/tabs-list:m-0"
				/>
			)}
		</>
	);
}

/**
 * A tab. `count` is a number after the name in mono; `dot` says this tab has something to handle: `warning` for an unsaved change, `proposal`
 * for something the assistant suggested. Say what the dot means in `dotLabel`.
 */
function TabsTrigger({
	className,
	children,
	count,
	countTone,
	countLabel,
	dot,
	dotLabel,
	...props
}: TabsPrimitive.Tab.Props & TabExtras) {
	return (
		<TabsPrimitive.Tab data-slot="tabs-trigger" className={cn(TAB, className)} {...props}>
			{children}
			<TabTail count={count} countTone={countTone} countLabel={countLabel} dot={dot} dotLabel={dotLabel} />
		</TabsPrimitive.Tab>
	);
}

/**
 * Tabs that go to another page (the languages of an entry, the pages of the tools page), not views of one page: links in the look of the `line`
 * tabs, or of the `toolbar` tabs under a page title, with `aria-current="page"` on the one you are on. A tab list would promise panels that are not
 * there. Put them in a `nav`.
 */
function TabLinks({
	variant = "line",
	className,
	...props
}: React.ComponentProps<"div"> & {
	/**
	 * `page`: the tab bar under a page head that runs the area's width (the settings and tools pages of the 2026-11 redesign): 40px (`height-tabs`), a
	 * `border-default` line across, 13px 500 words 20px apart, the picked one in ink with its 2px underline on the line.
	 */
	/**
	 * `entry`: the languages over an entry's title in the editor (2026-11 editor mockup `editor.html`, `.doc .langs`): a 32px row with no line across,
	 * 13px 500 words 20px apart, the picked one's 2px underline across the row's bottom edge.
	 */
	variant?: "line" | "toolbar" | "page" | "entry";
}) {
	return (
		<div
			data-slot="tab-links"
			data-variant={variant}
			className={cn(
				"group/tabs-list flex w-fit gap-monti-20",
				variant === "line" && "items-end text-monti-label",
				variant === "toolbar" && "items-baseline text-monti-body",
				variant === "page" &&
					"h-monti-tabs w-full shrink-0 items-stretch border-monti-default border-b text-monti-label",
				variant === "entry" && "h-monti-control-md shrink-0 items-stretch text-monti-label",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * One link of {@link TabLinks}. An `<a>`; the app's router link goes in `render` (`render={<Link href="…" />}`). `current` marks the page you
 * are on with `aria-current="page"` and the picked look.
 */
function TabLink({
	className,
	children,
	current = false,
	count,
	countTone,
	countLabel,
	dot,
	dotLabel,
	render,
	...props
}: useRender.ComponentProps<"a"> & TabExtras & { current?: boolean }) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(TAB, className),
				"aria-current": current ? "page" : undefined,
				children: (
					<>
						{children}
						<TabTail count={count} countTone={countTone} countLabel={countLabel} dot={dot} dotLabel={dotLabel} />
					</>
				),
			},
			props,
		),
		render,
		state: { slot: "tab-link", active: current },
	});
}

function TabsContent({
	className,
	fill = false,
	scroll = false,
	...props
}: TabsPrimitive.Panel.Props & {
	/** Takes the height left under the tabs, as a column (a pane with its own list or editor). */
	fill?: boolean;
	/** Scrolls inside instead of growing the page. */
	scroll?: boolean;
}) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			className={cn(
				// The panel is a stop of the Tab key. Its ring is inside it, where no scrolling or clipping box cuts it, and drawn as a line around
				// (2px in), not as a shadow: a shadow inside is painted under what the panel holds, and a first row with a ground would cover it; the
				// line is painted over them and stays put while the panel scrolls. No `outline-none` here: it would unset the line's style.
				"flex-1 text-monti-body focus-visible:outline-2 focus-visible:outline-monti-contrast/60 focus-visible:-outline-offset-2",
				fill && "flex min-h-0 flex-col",
				scroll && "min-h-0 overflow-auto",
				className,
			)}
			{...props}
		/>
	);
}

export { TabLink, TabLinks, Tabs, TabsContent, TabsList, TabsTrigger };
