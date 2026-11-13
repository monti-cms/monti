"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "./cn";
import { Grip } from "./grip";

/**
 * A rounded square of 20 × 24, Notion's handle: a light ground when pointed at, the pressed ground while its menu is open (2026-11-14, owner). It
 * is the one pressable thing of a line's height on the page that is not a pill (button.md, the shape rule).
 */
const HANDLE_BUTTON =
	"flex h-monti-control-xs w-monti-20 cursor-pointer items-center justify-center rounded-monti-md border-0 bg-transparent p-0 text-monti-faint outline-none transition-colors hover:bg-monti-muted hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/50 aria-expanded:bg-monti-selected aria-expanded:text-monti-default data-active:bg-monti-selected data-active:text-monti-default";

/**
 * The grip in the left margin of an editor block (no + beside it: a new block starts with Enter and "/", 2026-11-06 owner). Pressing it opens the block
 * menu and dragging it moves the block, so the grip takes the drag events (`onDragStart`, `onDragEnd`, `draggable`). While the menu is open `active` keeps the grip pressed.
 * To make the grip the trigger of a menu, wrap it with `trigger`: `trigger={(grip) => <DropdownMenuTrigger render={grip} />}`. The same in every
 * editor (an entry's body, a template's, a translation's).
 */
function BlockHandle({
	gripLabel,
	active = false,
	trigger,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "children"> & {
	/** The name of the grip for screen readers. */
	gripLabel: string;
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
		<span data-slot="block-handle" className={cn("flex", className)}>
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

/**
 * The box a drag from the margin outside the text draws to pick blocks (editor-tools.md, picking several blocks): a thin line, never a fill, so the
 * blocks under it show their own picked ground and the text stays readable. The editor sets its place and size (`EditorOverlay`).
 */
function PickBox() {
	return (
		<div
			data-slot="pick-box"
			aria-hidden="true"
			className="pointer-events-none size-full rounded-monti-sm border border-monti-emphasis"
		/>
	);
}

export { Block, BlockHandle, PickBox };
