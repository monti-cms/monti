import { CheckIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "./cn";

/**
 * The floating card every menu, picker list and popover is drawn on: paper, an emphasis border, the largest radius and the floating shadow. A list card adds 6px inside (`p-monti-6`); the parts below are what goes in it.
 */
export const MENU_CARD =
	"flex flex-col rounded-monti-xl border border-monti-emphasis bg-monti-page text-monti-body text-monti-default shadow-monti-floating outline-none";

/** How a card opens and closes, whichever side it opens to. */
export const MENU_MOTION =
	"origin-(--transform-origin) duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-open:animate-in";

const ROW =
	"flex min-w-0 cursor-default select-none items-center gap-[10px] rounded-monti-md px-[9px] py-[7px] text-monti-body text-monti-muted outline-hidden [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-monti-subtle";

/**
 * One row of a menu or picker list (Base UI: menu, select, combobox). The row the pointer or the keyboard is on, and the row whose second
 * level is open, take the selected background. A row that is the current value of a pick-one list does not: it ends in a {@link MenuTick}.
 */
export const MENU_ITEM = cn(
	ROW,
	"data-highlighted:bg-monti-selected data-highlighted:text-monti-default data-popup-open:bg-monti-selected data-popup-open:text-monti-default data-disabled:pointer-events-none data-disabled:text-monti-faint data-disabled:[&>svg]:text-monti-faint data-[variant=danger]:text-monti-danger data-[variant=danger]:data-highlighted:text-monti-danger data-[variant=danger]:[&>svg]:text-monti-danger",
);

/** The same row inside a searchable list (cmdk marks the row it is on with `data-selected`). */
export const COMMAND_ITEM = cn(
	ROW,
	"data-[selected=true]:bg-monti-selected data-[selected=true]:text-monti-default data-[disabled=true]:pointer-events-none data-[disabled=true]:text-monti-faint",
);

/** A group's name: mono, small, with room at the end for a count. */
export const MENU_LABEL = "flex justify-between px-[9px] pt-monti-6 pb-[3px] text-monti-micro text-monti-subtle";

/** The rule between two groups. */
export const MENU_SEPARATOR = "mx-[2px] my-[5px] h-px shrink-0 bg-monti-divider";

/** The current value of a pick-one list: a ✓ at the end of the row. */
export const MENU_TICK =
	"ml-auto flex shrink-0 text-monti-default [&_svg]:size-4 [[data-slot=menu-shortcut]+&]:ml-monti-8 [[data-slot=menu-value]+&]:ml-monti-8";

/** The mark on a row that opens a second level. After a value it sits 4px from it. */
export const MENU_SUB_MARK = "ml-auto [[data-slot=menu-value]+&]:ml-monti-4";

/** A long list: one column, 320px high at most, scrolling inside. */
export const MENU_SCROLL = "flex max-h-80 flex-col overflow-y-auto overscroll-contain";

/** The ✓ of a row that is the current value. */
function MenuTick({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span data-slot="menu-tick" className={cn(MENU_TICK, className)} {...props}>
			<CheckIcon aria-hidden />
		</span>
	);
}

/** A key combination at the end of a row ("⇧⌘D"). Mono; on a row that cannot be used it can say why ("in use"). */
function MenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="menu-shortcut"
			className={cn("ml-auto shrink-0 whitespace-nowrap text-monti-micro text-monti-subtle", className)}
			{...props}
		/>
	);
}

/** The current value of a row that opens a second level ("Modified · newest first"), faint, before the ›. */
function MenuValue({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="menu-value"
			className={cn("ml-auto shrink-0 whitespace-nowrap text-monti-caption text-monti-subtle", className)}
			{...props}
		/>
	);
}

export { MenuShortcut, MenuTick, MenuValue };
