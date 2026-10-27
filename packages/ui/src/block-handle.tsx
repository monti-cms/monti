"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "./cn";
import { Grip } from "./grip";

const HANDLE_BUTTON =
	"flex size-6 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-monti-faint outline-none transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 aria-expanded:bg-monti-selected aria-expanded:text-monti-default data-active:bg-monti-selected data-active:text-monti-default";

/**
 * The two marks in the left margin of an editor block: a + that adds a block below, and the grip. Pressing the grip opens the block menu and dragging it
 * moves the block, so the grip takes the drag events (`onDragStart`, `onDragEnd`, `draggable`). While the menu is open `active` keeps the grip pressed.
 * To make the grip the trigger of a menu, wrap it with `trigger`: `trigger={(grip) => <DropdownMenuTrigger render={grip} />}`.
 */
function BlockHandle({
	addLabel,
	gripLabel,
	onAdd,
	active = false,
	trigger,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "children" | "onClick"> & {
	/** The name of the + button for screen readers. */
	addLabel: string;
	/** The name of the grip for screen readers. */
	gripLabel: string;
	onAdd?: () => void;
	/** The block menu is open. */
	active?: boolean;
	trigger?: (grip: ReactElement) => ReactElement;
}) {
	const grip = (
		<ButtonPrimitive
			type="button"
			aria-label={gripLabel}
			data-active={active || undefined}
			className={HANDLE_BUTTON}
			{...props}
		>
			<Grip />
		</ButtonPrimitive>
	);
	return (
		<span data-slot="block-handle" className={cn("flex gap-monti-8", className)}>
			<ButtonPrimitive type="button" aria-label={addLabel} className={HANDLE_BUTTON} onClick={onAdd}>
				+
			</ButtonPrimitive>
			{trigger ? trigger(grip) : grip}
		</span>
	);
}

/**
 * A block of the editor's text. While its menu is open (`active`) it has the block background, to show which block the menu is about. It sets
 * no type: the text inside is the editor's.
 */
function Block({ active = false, className, ...props }: ComponentProps<"div"> & { active?: boolean }) {
	return (
		<div
			data-slot="block"
			data-active={active || undefined}
			className={cn("rounded-monti-md px-monti-8 data-active:bg-monti-block", className)}
			{...props}
		/>
	);
}

export { Block, BlockHandle };
