"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useDndContext } from "@dnd-kit/core";
import * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";
import { CutWords } from "./cut-words";
import { Add, Draggable, Locked } from "./icons";
import { HELD, SLOT } from "./sortable";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * Tabs that sit on a box like folder tabs, for a list of fields split into pages. The picked tab has the box's background and is open at the
 * bottom, so it joins the box; the others are closed and grey. Put a `FolderTabsList` and then a `FolderTabsBody` inside.
 */
function FolderTabs({ className, ...props }: TabsPrimitive.Root.Props) {
	return <TabsPrimitive.Root data-slot="folder-tabs" className={cn("flex flex-col", className)} {...props} />;
}

/**
 * The row of tabs: its tabs shrink first (their names are cut and say themselves whole), and only when even the shrunk tabs do not fit it scrolls sideways, never up and down (its focus rings are inside the tabs, so nothing is cut). `add` is the button that adds a tab (`FolderTabsAdd`). While a tab is dragged with the keyboard, the arrow keys move it instead of
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
			className={cn(
				"relative z-1 -mb-px flex items-end gap-monti-4 overflow-x-auto overflow-y-hidden [&>:has([data-digits='2'])]:[--folder-tab-digits:2] [&>:has([data-digits='3'])]:[--folder-tab-digits:3] [&>:has([data-slot=count])]:min-w-[calc(0.875rem_+_1rem_+_1.4*var(--monti-text-body-size)_+_0.6*var(--monti-text-caption-size)*var(--folder-tab-digits,1)_+_1.75rem_+_2px)] [&>:not([data-slot=folder-tabs-add])]:shrink",
				className,
			)}
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
	"inline-flex h-monti-control-lg items-center gap-monti-8 whitespace-nowrap rounded-t-monti-lg border border-monti-default pr-monti-16 pl-monti-12 text-monti-body [&_svg]:shrink-0 [&_[data-slot=count]]:shrink-0";

/**
 * A tab's name. A tab is never wider than its name, and a full row shrinks its tabs only down to the least of their own width and 4.5rem: the cell holds the
 * name (cut by `CutWords`, saying itself whole) and a hidden copy of it that is at most 4.5rem wide, which is the narrowest the cell's column goes. Only when
 * even the shrunk tabs do not fit does the row scroll. A locked tab has one speaker: its tooltip, which gives the reason always and the name whole only when the name is cut, as `CutWords` does, so the name does not speak twice (`speaks`). A tab with a count has its own floor (the row's) and no copy of the name.
 */
function TabName({
	children,
	speaks = true,
	floor = true,
	cell,
}: {
	children: React.ReactNode;
	speaks?: boolean;
	floor?: boolean;
	/** The cell's element, for a tab that speaks through its own tooltip and asks whether its name is cut. */
	cell?: React.Ref<HTMLSpanElement>;
}) {
	return (
		<span
			ref={cell}
			data-name={floor && typeof children === "string" ? children : undefined}
			className="grid after:invisible after:col-start-1 after:row-start-1 after:block after:h-0 after:max-w-18 after:overflow-clip after:whitespace-nowrap after:content-[attr(data-name)] [&>*]:col-start-1 [&>*]:row-start-1"
		>
			<CutWords cut={speaks} render={<span className="min-w-0 truncate" />}>
				{children}
			</CutWords>
		</span>
	);
}

/** What moves a tab while it is dragged, or while the others make room for it. */
export interface TabMotion {
	transform?: string;
	transition?: string;
}

/**
 * One tab: a grip to drag it by, its name, and how many fields it holds. `locked` marks a tab a plugin placed, which cannot be moved or
 * removed, and is why ("placed by the SEO plugin"): the lock is named by it, and the tab says it in a tooltip to a pointer on the tab and to the
 * keyboard on it (the lock is inside the tab's button, so it cannot be a stop of its own). `motion` moves the tab while it makes room for another; `dragging` is the gap the tab in hand left. `dropTarget` is the tab a field or
 * group is held over: dropped there, it goes to the end of this tab. The tab in hand itself is {@link FolderTabLifted}.
 */
function FolderTab({
	children,
	count,
	locked,
	draggable = true,
	motion,
	dragging = false,
	dropTarget = false,
	className,
	...props
}: Omit<TabsPrimitive.Tab.Props, "style"> & {
	count?: React.ReactNode;
	/** Why the tab cannot be moved or removed: the lock's name and the tab's tooltip. */
	locked?: string;
	/** Shows the grip. Off for a tab that stays where it is. */
	draggable?: boolean;
	motion?: TabMotion;
	dragging?: boolean;
	/** A field or group is held over this tab. */
	dropTarget?: boolean;
}) {
	// A locked tab speaks once, through its tooltip: the reason always, and the name only when the name is cut (as `CutWords` does everywhere).
	const nameCell = React.useRef<HTMLSpanElement>(null);
	const [nameCut, setNameCut] = React.useState(false);
	const tab = (
		<TabsPrimitive.Tab
			data-slot="folder-tab"
			data-held={dragging || undefined}
			data-drop-target={dropTarget || undefined}
			style={motion}
			className={cn(
				FOLDER_TAB,
				"data-active:border-b-(color:--monti-bg-page) max-w-full cursor-pointer bg-monti-muted text-monti-muted outline-none transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/60 focus-visible:ring-inset data-active:bg-monti-page data-active:font-semibold data-active:text-monti-default",
				// A tab that holds a count (and holds its grip and lock) is clipped by its own box, which the row gives 5.25rem at the least (its grip and its count stay whole); one with its name only goes
				// down to its name's own floor (`TabName`).
				count !== undefined && "overflow-hidden",
				dragging && SLOT,
				dropTarget && "bg-monti-selected text-monti-default ring-[1.5px] ring-monti-contrast ring-inset",
				className,
			)}
			{...props}
		>
			{draggable && !locked && <Draggable aria-hidden className="size-3.5 text-monti-faint" />}
			<TabName speaks={!locked} floor={count === undefined} cell={nameCell}>
				{children}
			</TabName>
			{count !== undefined && <Count data-digits={String(count).length}>{count}</Count>}
			{locked && <Locked role="img" aria-label={locked} className="size-3 text-monti-faint" />}
		</TabsPrimitive.Tab>
	);
	if (!locked) return tab;
	return (
		<Tooltip
			onOpenChange={(open) => {
				const name = nameCell.current?.querySelector<HTMLElement>(".truncate");
				if (open) setNameCut(name ? name.scrollWidth > name.clientWidth : false);
			}}
		>
			<TooltipTrigger render={tab} />
			<TooltipContent>
				{nameCut && typeof children === "string" ? <span className="block">{children}</span> : null}
				{locked}
			</TooltipContent>
		</Tooltip>
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
			className={cn(
				FOLDER_TAB,
				"border-b-(color:--monti-bg-page) bg-monti-page text-monti-default",
				// The name typed in the open tab is as wide as its words (the block's own title rule is 100%), so the open tab does not take the row.
				"[&_[data-slot=block-title]]:field-sizing-content [&_[data-slot=block-title]]:w-auto [&_[data-slot=block-title]]:min-w-[3ch]",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

/** The button after the last tab that adds one: its own 16px plus icon, named by its `aria-label`. It takes no children: a screen's "+" in its place
 * was a typed glyph, not the icon. */
function FolderTabsAdd({ className, ...props }: Omit<ButtonPrimitive.Props, "children">) {
	return (
		<ButtonPrimitive
			data-slot="folder-tabs-add"
			type="button"
			className={cn(
				"inline-flex h-monti-control-lg cursor-pointer items-center border-0 bg-transparent px-monti-12 text-monti-body text-monti-subtle outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/60 focus-visible:ring-inset",
				className,
			)}
			{...props}
		>
			<Add aria-hidden className="size-monti-icon-md" />
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
				// The box is a stop of the Tab key. Its ring is inside it, on a layer over its rows: a ring on the box itself is painted under them, and a
				// row with a ground (a group's) would cover it. The layer takes no press.
				"relative overflow-hidden rounded-monti-lg rounded-tl-none border border-monti-default outline-none focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:z-10 focus-visible:after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-monti-contrast/60 focus-visible:after:ring-inset focus-visible:after:content-[''] [&>ul>li:first-child]:border-t-0 [&>ul>li:last-child]:border-b-0",
				className,
			)}
			{...props}
		/>
	);
}

export { FolderTab, FolderTabEdit, FolderTabLifted, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList };
