"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useDndContext } from "@dnd-kit/core";
import type * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";
import { Add, Draggable, Locked } from "./icons";
import { HELD, SLOT } from "./sortable";

/**
 * Tabs that sit on a box like folder tabs, for a list of fields split into pages. The picked tab has the box's background and is open at the
 * bottom, so it joins the box; the others are closed and grey. Put a `FolderTabsList` and then a `FolderTabsBody` inside.
 */
function FolderTabs({ className, ...props }: TabsPrimitive.Root.Props) {
	return <TabsPrimitive.Root data-slot="folder-tabs" className={cn("flex flex-col", className)} {...props} />;
}

/**
 * The row of tabs. `add` is the button that adds a tab (`FolderTabsAdd`). While a tab is dragged with the keyboard, the arrow keys move it instead of
 * the focus.
 */
function FolderTabsList({
	add,
	children,
	className,
	onKeyDown,
	...props
}: TabsPrimitive.List.Props & { add?: React.ReactNode }) {
	const { active } = useDndContext();
	return (
		<TabsPrimitive.List
			data-slot="folder-tabs-list"
			className={cn("relative z-1 -mb-px flex items-end gap-monti-4", className)}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				if (active && event.key.startsWith("Arrow")) event.preventBaseUIHandler();
			}}
			{...props}
		>
			{children}
			{add}
		</TabsPrimitive.List>
	);
}

/** What every tab shares: 36px, a line on three sides, rounded at the top. */
const FOLDER_TAB =
	"inline-flex h-monti-control-lg items-center gap-monti-8 whitespace-nowrap rounded-t-monti-lg border border-monti-default pr-monti-16 pl-monti-12 text-monti-body [&_svg]:shrink-0";

/** What moves a tab while it is dragged, or while the others make room for it. */
export interface TabMotion {
	transform?: string;
	transition?: string;
}

/**
 * One tab: a grip to drag it by, its name, and how many fields it holds. `locked` marks a tab a plugin placed, which cannot be moved or
 * removed. `motion` moves the tab while it makes room for another; `dragging` is the gap the tab in hand left. `dropTarget` is the tab a field or
 * group is held over: dropped there, it goes to the end of this tab. The tab in hand itself is {@link FolderTabLifted}.
 */
function FolderTab({
	children,
	count,
	locked = false,
	draggable = true,
	motion,
	dragging = false,
	dropTarget = false,
	className,
	...props
}: Omit<TabsPrimitive.Tab.Props, "style"> & {
	count?: React.ReactNode;
	locked?: boolean;
	/** Shows the grip. Off for a tab that stays where it is. */
	draggable?: boolean;
	motion?: TabMotion;
	dragging?: boolean;
	/** A field or group is held over this tab. */
	dropTarget?: boolean;
}) {
	return (
		<TabsPrimitive.Tab
			data-slot="folder-tab"
			data-held={dragging || undefined}
			data-drop-target={dropTarget || undefined}
			style={motion}
			className={cn(
				FOLDER_TAB,
				"data-active:border-b-(color:--monti-bg-page) cursor-pointer bg-monti-muted text-monti-muted outline-none transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/50 data-active:bg-monti-page data-active:font-semibold data-active:text-monti-default",
				dragging && SLOT,
				dropTarget && "bg-monti-selected text-monti-default ring-[1.5px] ring-monti-contrast ring-inset",
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
 * The tab in hand, drawn by the `Sortable` overlay over the page (outside the tab row): the tab's shape with its name and count, floating on the
 * page ground with the floating shadow.
 */
function FolderTabLifted({
	children,
	count,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "style"> & { count?: React.ReactNode }) {
	return (
		<div
			data-slot="folder-tab-lifted"
			className={cn(FOLDER_TAB, HELD, "cursor-grabbing font-semibold text-monti-default", className)}
			{...props}
		>
			<Draggable aria-hidden className="size-3.5 text-monti-faint" />
			{children}
			{count !== undefined && <Count>{count}</Count>}
		</div>
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
				"inline-flex h-monti-control-lg cursor-pointer items-center border-0 bg-transparent px-monti-12 text-monti-body text-monti-subtle outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/50",
				className,
			)}
			{...props}
		>
			{children ?? <Add aria-hidden className="size-monti-icon-md" />}
		</ButtonPrimitive>
	);
}

/**
 * The box under the tabs: the fields of the picked tab (a `FieldTree` without its outer rules, the box has its own). Its top-left corner is square, where
 * the picked tab joins it.
 */
function FolderTabsBody({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			data-slot="folder-tabs-body"
			className={cn(
				"overflow-hidden rounded-monti-lg rounded-tl-none border border-monti-default outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50 focus-visible:ring-inset [&>ul>li:first-child]:border-t-0 [&>ul>li:last-child]:border-b-0",
				className,
			)}
			{...props}
		/>
	);
}

export { FolderTab, FolderTabEdit, FolderTabLifted, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList };
