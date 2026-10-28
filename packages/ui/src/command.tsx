"use client";

import { Search } from "@carbon/icons-react";
import { Command as CommandPrimitive } from "cmdk";
import type * as React from "react";
import { cn } from "./cn";
import { COMMAND_ITEM, MENU_SCROLL, MENU_SEPARATOR, MenuTick } from "./menu-parts";

/**
 * A menu you can search: a search line on top, the rows under it, and the keyboard never leaves the line. It is the content of a card (a
 * `PopoverContent` with `padding="menu"`); typing filters the rows across groups.
 */
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn("flex size-full flex-col text-monti-body text-monti-default", className)}
			{...props}
		/>
	);
}

/** The search line: a magnifier and the words, with a rule under it. */
function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div
			data-slot="command-input-wrapper"
			className="mb-monti-4 flex items-center gap-monti-8 border-monti-muted border-b px-[9px] pt-monti-6 pb-[9px]"
		>
			<Search className="size-3.5 shrink-0 text-monti-subtle" aria-hidden />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					"w-full bg-transparent text-monti-body text-monti-default outline-hidden placeholder:text-monti-faint disabled:cursor-not-allowed disabled:opacity-45",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

/** The rows: one column, 320px high at most, scrolling inside. */
function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return <CommandPrimitive.List data-slot="command-list" className={cn(MENU_SCROLL, className)} {...props} />;
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className={cn("px-[9px] py-monti-12 text-center text-monti-body text-monti-subtle", className)}
			{...props}
		/>
	);
}

/** Rows under a name (the `heading`), in the mono group-name look. */
function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				"**:[[cmdk-group-heading]]:px-[9px] **:[[cmdk-group-heading]]:pt-monti-6 **:[[cmdk-group-heading]]:pb-[3px] **:[[cmdk-group-heading]]:text-monti-micro **:[[cmdk-group-heading]]:text-monti-subtle",
				className,
			)}
			{...props}
		/>
	);
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator data-slot="command-separator" className={cn(MENU_SEPARATOR, className)} {...props} />
	);
}

/**
 * A row. `checked` marks the current value of a pick-one list with a ✓ at its end (cmdk itself only tracks the row the keyboard is on, which
 * takes the selected background). `variant="danger"` is for what cannot be undone: red, and the last row of its group.
 */
function CommandItem({
	className,
	children,
	checked,
	variant = "default",
	...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & {
	checked?: boolean;
	variant?: "default" | "danger";
}) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			data-variant={variant}
			data-checked={checked ? "true" : undefined}
			className={cn(COMMAND_ITEM, className)}
			{...props}
		>
			{children}
			{checked && <MenuTick />}
		</CommandPrimitive.Item>
	);
}

/** A row under the list for what belongs to the whole list ("+ New tag"), set off by a rule and always in view. */
function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="command-footer"
			className={cn("mt-monti-4 flex flex-col border-monti-muted border-t pt-monti-4", className)}
			{...props}
		/>
	);
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandFooter, CommandSeparator };
