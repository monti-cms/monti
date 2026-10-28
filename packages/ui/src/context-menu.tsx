"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
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
	SUB_ALIGN_OFFSET,
	SUB_SIDE_OFFSET,
} from "./menu-parts";

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
	return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({ className, ...props }: ContextMenuPrimitive.Trigger.Props) {
	return (
		<ContextMenuPrimitive.Trigger
			data-slot="context-menu-trigger"
			className={cn("select-none", className)}
			{...props}
		/>
	);
}

/**
 * What opens at the cursor on a right click of a row or tile: the menu card at 232px, a 16px icon first on each row, a shortcut or a › at the
 * end. What cannot be undone is last, in red. A further value opens a second level at the side.
 */
function ContextMenuContent({
	className,
	align = "start",
	alignOffset = 4,
	side = "right",
	sideOffset = 0,
	...props
}: ContextMenuPrimitive.Popup.Props &
	Pick<ContextMenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Positioner
				className="isolate z-50 outline-none"
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
			>
				<ContextMenuPrimitive.Popup
					data-slot="context-menu-content"
					className={cn(
						MENU_CARD,
						"p-monti-6",
						MENU_MOTION,
						"z-50 max-h-(--available-height) w-58 overflow-y-auto overflow-x-hidden data-closed:overflow-hidden",
						className,
					)}
					{...props}
				/>
			</ContextMenuPrimitive.Positioner>
		</ContextMenuPrimitive.Portal>
	);
}

function ContextMenuGroup({ ...props }: ContextMenuPrimitive.Group.Props) {
	return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />;
}

function ContextMenuLabel({ className, ...props }: ContextMenuPrimitive.GroupLabel.Props) {
	return (
		<ContextMenuPrimitive.GroupLabel data-slot="context-menu-label" className={cn(MENU_LABEL, className)} {...props} />
	);
}

/** A row, as in the dropdown menu: `variant="danger"` is red, a row that cannot be used is faint and can say why in its `MenuShortcut`. */
function ContextMenuItem({
	className,
	variant = "default",
	...props
}: ContextMenuPrimitive.Item.Props & {
	variant?: "default" | "danger";
}) {
	return (
		<ContextMenuPrimitive.Item
			data-slot="context-menu-item"
			data-variant={variant}
			className={cn(MENU_ITEM, className)}
			{...props}
		/>
	);
}

function ContextMenuSub({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props) {
	return <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />;
}

/** A row that picks a further value ("Move to folder ›"). → opens the second level, ← closes it. */
function ContextMenuSubTrigger({ className, children, ...props }: ContextMenuPrimitive.SubmenuTrigger.Props) {
	return (
		<ContextMenuPrimitive.SubmenuTrigger
			data-slot="context-menu-sub-trigger"
			className={cn(MENU_ITEM, className)}
			{...props}
		>
			{children}
			<ChevronRight aria-hidden className={MENU_SUB_MARK} />
		</ContextMenuPrimitive.SubmenuTrigger>
	);
}

function ContextMenuSubContent({
	align = "start",
	alignOffset = SUB_ALIGN_OFFSET,
	side = "right",
	sideOffset = SUB_SIDE_OFFSET,
	...props
}: React.ComponentProps<typeof ContextMenuContent>) {
	return (
		<ContextMenuContent
			data-slot="context-menu-sub-content"
			align={align}
			alignOffset={alignOffset}
			side={side}
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

function ContextMenuSeparator({ className, ...props }: ContextMenuPrimitive.Separator.Props) {
	return (
		<ContextMenuPrimitive.Separator
			data-slot="context-menu-separator"
			className={cn(MENU_SEPARATOR, "first:hidden last:hidden", className)}
			{...props}
		/>
	);
}

export {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuGroup,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
};
