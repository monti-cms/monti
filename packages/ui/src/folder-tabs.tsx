"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { Add, Draggable, Locked } from "@carbon/icons-react";
import type * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";

/**
 * Tabs that sit on a box like folder tabs, for a list of fields split into pages. The picked tab has the box's background and is open at the
 * bottom, so it joins the box; the others are closed and grey. Put a `FolderTabsList` and then a `FolderTabsBody` inside.
 */
function FolderTabs({ className, ...props }: TabsPrimitive.Root.Props) {
	return <TabsPrimitive.Root data-slot="folder-tabs" className={cn("flex flex-col", className)} {...props} />;
}

/** The row of tabs. `add` is the button that adds a tab (`FolderTabsAdd`). */
function FolderTabsList({ add, children, className, ...props }: TabsPrimitive.List.Props & { add?: React.ReactNode }) {
	return (
		<TabsPrimitive.List
			data-slot="folder-tabs-list"
			className={cn("relative z-1 -mb-px flex items-end gap-monti-4", className)}
			{...props}
		>
			{children}
			{add}
		</TabsPrimitive.List>
	);
}

/**
 * One tab: a grip to drag it by, its name, and how many fields it holds. `locked` marks a tab a plugin placed, which cannot be moved or
 * removed.
 */
function FolderTab({
	children,
	count,
	locked = false,
	draggable = true,
	className,
	...props
}: TabsPrimitive.Tab.Props & {
	count?: React.ReactNode;
	locked?: boolean;
	/** Shows the grip. Off for a tab that stays where it is. */
	draggable?: boolean;
}) {
	return (
		<TabsPrimitive.Tab
			data-slot="folder-tab"
			className={cn(
				"data-active:border-b-(color:--monti-bg-page) inline-flex h-9 cursor-pointer items-center gap-monti-8 whitespace-nowrap rounded-t-monti-lg border border-monti-default bg-monti-muted pr-monti-16 pl-monti-12 text-monti-body text-monti-muted outline-none transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 data-active:bg-monti-page data-active:font-semibold data-active:text-monti-default [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{draggable && !locked && <Draggable aria-hidden className="size-3.5 text-monti-faint" />}
			{children}
			{count !== undefined && <Count>{count}</Count>}
			{locked && <Locked aria-hidden className="size-3 text-monti-faint" />}
		</TabsPrimitive.Tab>
	);
}

/** The button after the last tab that adds one: a 16px plus icon, named by its `aria-label`. */
function FolderTabsAdd({ className, children, ...props }: ButtonPrimitive.Props) {
	return (
		<ButtonPrimitive
			data-slot="folder-tabs-add"
			type="button"
			className={cn(
				"inline-flex h-9 cursor-pointer items-center border-0 bg-transparent px-monti-12 text-monti-body text-monti-subtle outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
				className,
			)}
			{...props}
		>
			{children ?? <Add aria-hidden className="size-monti-icon-md" />}
		</ButtonPrimitive>
	);
}

/** The box under the tabs: the fields of the picked tab (a `FieldTree` without its outer rules, the box has its own). Its top-left corner is square, where the picked tab joins it. */
function FolderTabsBody({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			data-slot="folder-tabs-body"
			className={cn(
				"overflow-hidden rounded-monti-lg rounded-tl-none border border-monti-default outline-none [&>ul>li:first-child]:border-t-0 [&>ul>li:last-child]:border-b-0",
				className,
			)}
			{...props}
		/>
	);
}

export { FolderTab, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList };
