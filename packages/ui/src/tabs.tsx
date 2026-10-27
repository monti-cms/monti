"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { Count } from "./count";

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
			className={cn("group/tabs flex flex-col", fill ? "min-h-0 flex-1 gap-0" : "gap-2", className)}
			{...props}
		/>
	);
}

/** The side padding of a bar, so its first tab lines up with the content's side padding. */
const BAR_INSET = { page: "px-monti-32", panel: "px-monti-24", none: "" } as const;

/**
 * The list of tabs: switches the view in the same place (language, status, a screen's sections, a panel's parts).
 * - `line` (default): underlined tabs, the picked one in ink at 600 with a 1.5px ink rule.
 * - `bar`: the tab row at the top of a pane, 44px with a rule under it that the picked tab's underline sits on; `inset` lines its first tab
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
				"group/tabs-list flex w-fit gap-monti-20 text-monti-note",
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

/**
 * A tab. `count` is a number after the name in mono; `dot` says this tab has something to handle: `warning` for an unsaved change, `proposal`
 * for something the assistant suggested. Say what the dot means in `dotLabel`.
 */
function TabsTrigger({
	className,
	children,
	count,
	dot,
	dotLabel,
	...props
}: TabsPrimitive.Tab.Props & {
	count?: React.ReactNode;
	dot?: "warning" | "proposal";
	dotLabel?: string;
}) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(
				"inline-flex cursor-pointer items-baseline gap-monti-4 whitespace-nowrap border-0 border-transparent border-b-[1.5px] bg-transparent px-0 pt-monti-4 pb-[3px] text-monti-subtle outline-none transition-colors hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 data-active:border-monti-contrast data-active:font-semibold data-active:text-monti-default [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:self-center",
				"group-data-[variant=toolbar]/tabs-list:border-b-0 group-data-[variant=toolbar]/tabs-list:p-0 group-data-[variant=toolbar]/tabs-list:data-active:font-bold",
				"group-data-[variant=bar]/tabs-list:-mb-px group-data-[variant=bar]/tabs-list:items-center group-data-[variant=bar]/tabs-list:gap-monti-6 group-data-[variant=bar]/tabs-list:pb-monti-12",
				className,
			)}
			{...props}
		>
			{children}
			{count !== undefined && <Count>{count}</Count>}
			{dot && (
				<ChangeDot
					tone={dot}
					label={dotLabel}
					className="mt-0.5 ml-0.5 self-center group-data-[variant=bar]/tabs-list:m-0"
				/>
			)}
		</TabsPrimitive.Tab>
	);
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
				"flex-1 text-monti-body outline-none",
				fill && "flex min-h-0 flex-col",
				scroll && "min-h-0 overflow-auto",
				className,
			)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
