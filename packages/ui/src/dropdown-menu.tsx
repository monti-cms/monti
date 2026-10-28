"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ChevronRight, Search } from "@carbon/icons-react";
import * as React from "react";
import { cn } from "./cn";
import { Grip } from "./grip";
import {
	MENU_CARD,
	MENU_ITEM,
	MENU_LABEL,
	MENU_MOTION,
	MENU_SCROLL,
	MENU_SEPARATOR,
	MENU_SUB_MARK,
	MenuTick,
	SUB_ALIGN_OFFSET,
	SUB_SIDE_OFFSET,
} from "./menu-parts";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
	return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
	return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
	return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

/**
 * The menu card, the design system's 240px (`--width-menu`); wider only for a longer row (20rem at most; a longer name is cut). A row that picks a further value opens a second
 * level at its side ({@link DropdownMenuSub}); a third level is not drawn.
 */
function DropdownMenuContent({
	align = "start",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 4,
	anchor,
	className,
	...props
}: MenuPrimitive.Popup.Props &
	Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "anchor">) {
	return (
		<MenuPrimitive.Portal>
			<MenuPrimitive.Positioner
				className="isolate z-50 outline-none"
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				anchor={anchor}
			>
				<MenuPrimitive.Popup
					data-slot="dropdown-menu-content"
					className={cn(
						MENU_CARD,
						"p-monti-6",
						MENU_MOTION,
						"z-50 max-h-(--available-height) w-max min-w-monti-menu max-w-[min(20rem,var(--available-width))] overflow-y-auto overflow-x-hidden data-closed:overflow-hidden",
						className,
					)}
					{...props}
				/>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
	return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

/** A group's name; give it room for a count by putting it in a child. */
function DropdownMenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
	return <MenuPrimitive.GroupLabel data-slot="dropdown-menu-label" className={cn(MENU_LABEL, className)} {...props} />;
}

/**
 * A row. An icon first, a name, a `MenuShortcut` at the end. `variant="danger"` is for what cannot be undone or takes something down, and goes
 * at the bottom of the menu. A row that cannot be used is faint and can say why in its `MenuShortcut`.
 */
function DropdownMenuItem({
	className,
	variant = "default",
	swatch = false,
	...props
}: MenuPrimitive.Item.Props & {
	variant?: "default" | "danger";
	/** A small square row in a grid of rows (a color sample), its content centered. */
	swatch?: boolean;
}) {
	return (
		<MenuPrimitive.Item
			data-slot="dropdown-menu-item"
			data-variant={variant}
			className={cn(MENU_ITEM, swatch && "justify-center p-monti-2", className)}
			{...props}
		/>
	);
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
	return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

/**
 * A row that picks a further value: its name, the current value in a `MenuValue` if there is one, and a ›. Pointing at it, or pressing →,
 * opens the second level at its side; ← closes it. The row keeps the selected background while the second level is open.
 */
function DropdownMenuSubTrigger({
	className,
	children,
	chevron = true,
	...props
}: MenuPrimitive.SubmenuTrigger.Props & {
	/** The › at the end. Off for a row that opens a card with no rows in it (a calendar), where the row says its current value with a `MenuTick` instead. */
	chevron?: boolean;
}) {
	return (
		<MenuPrimitive.SubmenuTrigger data-slot="dropdown-menu-sub-trigger" className={cn(MENU_ITEM, className)} {...props}>
			{children}
			{chevron && <ChevronRight aria-hidden className={MENU_SUB_MARK} />}
		</MenuPrimitive.SubmenuTrigger>
	);
}

/** The second level. It opens toward the side with room, and its first row lines up with the row that opened it. */
function DropdownMenuSubContent({
	align = "start",
	alignOffset = SUB_ALIGN_OFFSET,
	side = "right",
	sideOffset = SUB_SIDE_OFFSET,
	bare = false,
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuContent> & {
	/** No padding of its own: the card holds something that brings its own (a calendar), not menu rows. */
	bare?: boolean;
}) {
	return (
		<DropdownMenuContent
			data-slot="dropdown-menu-sub-content"
			className={cn(bare && "p-0", className)}
			align={align}
			alignOffset={alignOffset}
			side={side}
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

/** What a group of reorderable rows shares: the row being dragged, and what to do when a row is dropped or moved with the keys. */
const ReorderContext = React.createContext<{
	dragging: string | null;
	setDragging: (id: string | null) => void;
	onReorder: (from: string, to: string) => void;
	onMove: (id: string, direction: -1 | 1) => void;
} | null>(null);

/**
 * A group of rows the writer puts in order (the columns of a list). Each row with a `reorderId` has a grip to drag it by; dropping it on another row
 * calls `onReorder(from, to)`, and Alt with ↑ or ↓ on a row calls `onMove(id, -1 | 1)`, so the order can be set without a pointer.
 */
function DropdownMenuReorderGroup({
	onReorder,
	onMove,
	children,
}: {
	onReorder: (from: string, to: string) => void;
	onMove: (id: string, direction: -1 | 1) => void;
	children: React.ReactNode;
}) {
	const [dragging, setDragging] = React.useState<string | null>(null);
	const value = React.useMemo(() => ({ dragging, setDragging, onReorder, onMove }), [dragging, onReorder, onMove]);
	return (
		<ReorderContext.Provider value={value}>
			<MenuPrimitive.Group data-slot="dropdown-menu-reorder-group">{children}</MenuPrimitive.Group>
		</ReorderContext.Provider>
	);
}

/** The ✓ in the box of a checked row, drawn so the state does not rest on color alone. */
const BOX_MARK = (
	<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5" aria-hidden="true">
		<path d="M2.3 6.9 5.1 9.7 10.7 4.1" />
	</svg>
);

/**
 * A row that is on or off. By default the ✓ is at its end while on. With `box` the row starts with a 14px check box instead (a list of values where
 * several can be on: the tags to filter by, the columns to show), and a `MenuShortcut` at the end can carry a count. Inside a
 * {@link DropdownMenuReorderGroup}, a `reorderId` adds the grip in front and makes the row movable.
 */
function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	box = false,
	reorderId,
	onKeyDown,
	...props
}: MenuPrimitive.CheckboxItem.Props & {
	/** Start the row with a check box (several can be on) instead of ending it with a ✓. */
	box?: boolean;
	/** Makes the row movable inside a {@link DropdownMenuReorderGroup}: the id the group reports. */
	reorderId?: string;
}) {
	const reorder = React.useContext(ReorderContext);
	const movable = reorder !== null && reorderId !== undefined;
	return (
		<MenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			data-dragging={movable && reorder.dragging === reorderId ? "" : undefined}
			className={cn(MENU_ITEM, "group/item data-dragging:opacity-45", className)}
			checked={checked}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				if (movable && event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
					event.preventDefault();
					event.stopPropagation();
					reorder.onMove(reorderId, event.key === "ArrowUp" ? -1 : 1);
				}
			}}
			onDragOver={movable ? (event) => reorder.dragging !== null && event.preventDefault() : undefined}
			onDrop={
				movable
					? (event) => {
							event.preventDefault();
							if (reorder.dragging !== null && reorder.dragging !== reorderId)
								reorder.onReorder(reorder.dragging, reorderId);
							reorder.setDragging(null);
						}
					: undefined
			}
			{...props}
		>
			{movable && (
				// biome-ignore lint/a11y/noStaticElementInteractions: the grip is a pointer handle for dragging; the keyboard moves the row itself with Alt and the arrow keys
				<span
					data-slot="menu-grip"
					draggable
					onDragStart={(event) => {
						event.dataTransfer.effectAllowed = "move";
						event.dataTransfer.setData("text/plain", reorderId);
						reorder.setDragging(reorderId);
					}}
					onDragEnd={() => reorder.setDragging(null)}
					className="-mr-monti-4 flex shrink-0 cursor-grab text-monti-faint"
				>
					<Grip />
				</span>
			)}
			{box && (
				<span
					data-slot="menu-box"
					className="relative flex size-3.5 shrink-0 items-center justify-center rounded-monti-sm border-[1.5px] border-monti-faint text-monti-on-emphasis transition-colors group-data-checked/item:border-monti-contrast group-data-checked/item:bg-monti-emphasis"
				>
					<MenuPrimitive.CheckboxItemIndicator render={<span className="flex">{BOX_MARK}</span>} />
				</span>
			)}
			{children}
			{!box && <MenuPrimitive.CheckboxItemIndicator render={<MenuTick />} />}
		</MenuPrimitive.CheckboxItem>
	);
}

/**
 * The search row on top of a long menu: a magnifier and a text field, then a rule. Typing filters the rows below (the caller does that); ↓ moves into them.
 * The keys a text needs (letters, ←, →, Home, End) stay in the field, so a menu's own type-ahead and second levels do not take them.
 */
function DropdownMenuSearch({
	value,
	onValueChange,
	label,
	placeholder = label,
}: {
	value: string;
	onValueChange: (value: string) => void;
	/** The name of the field, for screen readers. */
	label: string;
	placeholder?: string;
}) {
	return (
		<div
			role="search"
			data-slot="dropdown-menu-search"
			className="mb-monti-4 flex items-center gap-monti-8 border-monti-muted border-b px-[9px] pt-[6px] pb-[9px] text-monti-default"
		>
			<Search aria-hidden className="size-3.5 shrink-0 text-monti-subtle" />
			<input
				type="text"
				aria-label={label}
				placeholder={placeholder}
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Escape" || event.key === "Tab")
						return;
					event.stopPropagation();
				}}
				className="min-w-0 flex-1 border-0 bg-transparent p-0 text-monti-body text-monti-default outline-none placeholder:text-monti-faint"
			/>
		</div>
	);
}

/** A long list in a menu: one column, 320px high at most, scrolling inside. */
function DropdownMenuScroll({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="dropdown-menu-scroll" className={cn(MENU_SCROLL, className)} {...props} />;
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
	return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/** A row of a pick-one list. The current value shows a ✓ at its end, not a background. Picking one applies it and closes the whole menu. */
function DropdownMenuRadioItem({ className, children, closeOnClick = true, ...props }: MenuPrimitive.RadioItem.Props) {
	return (
		<MenuPrimitive.RadioItem
			data-slot="dropdown-menu-radio-item"
			closeOnClick={closeOnClick}
			className={cn(MENU_ITEM, className)}
			{...props}
		>
			{children}
			<MenuPrimitive.RadioItemIndicator render={<MenuTick />} />
		</MenuPrimitive.RadioItem>
	);
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
	return (
		<MenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cn(MENU_SEPARATOR, "first:hidden last:hidden", className)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuPortal,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuReorderGroup,
	DropdownMenuScroll,
	DropdownMenuSearch,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
};
