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

/** What every tab shares: 36px, a line on three sides, rounded at the top. */
const FOLDER_TAB =
	"inline-flex h-9 items-center gap-monti-8 whitespace-nowrap rounded-t-monti-lg border border-monti-default pr-monti-16 pl-monti-12 text-monti-body [&_svg]:shrink-0";

/** What moves a tab while it is dragged, or while the others make room for it. */
interface TabMotion {
	transform?: string;
	transition?: string;
}

/**
 * One tab: a grip to drag it by, its name, and how many fields it holds. `locked` marks a tab a plugin placed, which cannot be moved or
 * removed. `motion` and `dragging` are the tab while it is dragged, or while the others move aside for it.
 */
function FolderTab({
	children,
	count,
	locked = false,
	draggable = true,
	motion,
	dragging = false,
	className,
	...props
}: Omit<TabsPrimitive.Tab.Props, "style"> & {
	count?: React.ReactNode;
	locked?: boolean;
	/** Shows the grip. Off for a tab that stays where it is. */
	draggable?: boolean;
	motion?: TabMotion;
	dragging?: boolean;
}) {
	return (
		<TabsPrimitive.Tab
			data-slot="folder-tab"
			style={motion}
			className={cn(
				FOLDER_TAB,
				"data-active:border-b-(color:--monti-bg-page) cursor-pointer bg-monti-muted text-monti-muted outline-none transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 data-active:bg-monti-page data-active:font-semibold data-active:text-monti-default",
				dragging && "z-10 opacity-80",
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

/**
 * The picked tab while its name is being edited in place: the same shape as the picked tab, with the field (`children`) where the name was. It is not a tab
 * while it is open, so a key typed in the field is the field's.
 */
function FolderTabEdit({ children, className, ...props }: Omit<React.ComponentProps<"div">, "style">) {
	return (
		<div
			data-slot="folder-tab-edit"
			className={cn(FOLDER_TAB, "border-b-(color:--monti-bg-page) bg-monti-page text-monti-default", className)}
			{...props}
		>
			{children}
		</div>
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

export { FolderTab, FolderTabEdit, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList };
