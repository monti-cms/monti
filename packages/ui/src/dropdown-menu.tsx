"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ChevronRight } from "@carbon/icons-react";
import type * as React from "react";
import { cn } from "./cn";
import {
	MENU_CARD,
	MENU_ITEM,
	MENU_LABEL,
	MENU_MOTION,
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
function DropdownMenuSubTrigger({ className, children, ...props }: MenuPrimitive.SubmenuTrigger.Props) {
	return (
		<MenuPrimitive.SubmenuTrigger data-slot="dropdown-menu-sub-trigger" className={cn(MENU_ITEM, className)} {...props}>
			{children}
			<ChevronRight aria-hidden className={MENU_SUB_MARK} />
		</MenuPrimitive.SubmenuTrigger>
	);
}

/** The second level. It opens toward the side with room, and its first row lines up with the row that opened it. */
function DropdownMenuSubContent({
	align = "start",
	alignOffset = SUB_ALIGN_OFFSET,
	side = "right",
	sideOffset = SUB_SIDE_OFFSET,
	...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
	return (
		<DropdownMenuContent
			data-slot="dropdown-menu-sub-content"
			align={align}
			alignOffset={alignOffset}
			side={side}
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

/** A row that is on or off, with the ✓ at its end while on. */
function DropdownMenuCheckboxItem({ className, children, checked, ...props }: MenuPrimitive.CheckboxItem.Props) {
	return (
		<MenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			className={cn(MENU_ITEM, className)}
			checked={checked}
			{...props}
		>
			{children}
			<MenuPrimitive.CheckboxItemIndicator render={<MenuTick />} />
		</MenuPrimitive.CheckboxItem>
	);
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
	return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/** A row of a pick-one list. The current value shows a ✓ at its end, not a background. */
function DropdownMenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
	return (
		<MenuPrimitive.RadioItem data-slot="dropdown-menu-radio-item" className={cn(MENU_ITEM, className)} {...props}>
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
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
};
