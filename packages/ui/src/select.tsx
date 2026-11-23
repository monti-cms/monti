"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import type * as React from "react";
import { Caret } from "./caret";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import { FIELD_HOVER, FIELD_INSET } from "./hover";
import { ChevronDown, ChevronUp } from "./icons";
import { MENU_CARD, MENU_ITEM, MENU_LABEL, MENU_MOTION, MENU_SEPARATOR, MenuTick } from "./menu-parts";
import { menuWords } from "./menu-words";
import { FIRST_PASS, FIT_HEIGHT, usePlacementPadding } from "./placement";
import { useProposalDescription } from "./proposal-cue";

/**
 * The select. `items` is every value with its label: the closed trigger shows the chosen item's label, and Base UI only knows the labels once the list has been
 * opened, so without `items` the trigger would show the raw value ("dev" for "Dev notes"). It is required, so that cannot be written.
 */
function Select<Value, Multiple extends boolean | undefined = false>(
	props: SelectPrimitive.Root.Props<Value, Multiple> & {
		items: NonNullable<SelectPrimitive.Root.Props<Value, Multiple>["items"]>;
	},
) {
	return (
		<SelectPrimitive.Root
			{...props}
			// A `readOnly` select is a value to read: its list does not open (Base UI's own would open to be looked through). The opening is
			// refused, and `open` is left as it was given: whether it is held from outside is settled on the first drawing, so a select that
			// turns read-only, or stops being it, would keep the wrong one.
			onOpenChange={(next, details) => {
				if (props.readOnly && next) {
					details.cancel();
					return;
				}
				props.onOpenChange?.(next, details);
			}}
		/>
	);
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
	return <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1", className)} {...props} />;
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
	// The value that runs past the field is cut to a line, and says itself whole (`CutWords`).
	return (
		<CutWords
			render={
				<SelectPrimitive.Value
					data-slot="select-value"
					className={cn("block min-w-0 flex-1 truncate text-left", className)}
					{...props}
				/>
			}
		/>
	);
}

/**
 * The look of a closed pick-one field, shared by {@link SelectTrigger} and `MenuField`: an underline, the value, and a caret at the end. The line turns
 * ink while it has focus or its list is open. An error's red line and a proposal's blue line stay under the keyboard's focus, which is then a ring
 * around the trigger: a state's colour is never taken for the focus, and the focus never takes the state's colour away (it has no caret to show). `data-size` is `default` (body text) or `sm` (note text, 2px less above and below).
 */
export const SELECT_TRIGGER = cn(
	FIELD_HOVER,
	"flex items-center justify-between gap-monti-8 whitespace-nowrap rounded-none border-0 border-transparent border-b bg-transparent text-left text-monti-body text-monti-default outline-none transition-colors focus-visible:border-monti-contrast aria-expanded:border-monti-contrast disabled:cursor-default disabled:opacity-45 aria-readonly:cursor-default aria-readonly:select-text aria-readonly:focus-visible:border-transparent aria-readonly:focus-visible:ring-2 aria-readonly:focus-visible:ring-monti-contrast/60 aria-readonly:[&_[data-slot=select-icon]]:hidden aria-invalid:border-monti-danger aria-invalid:focus-visible:ring-2 aria-invalid:focus-visible:ring-monti-contrast/60 data-[size=default]:h-monti-control-md data-[size=md]:h-monti-control-md data-[size=sm]:h-monti-control-sm data-[size=sm]:text-monti-note [&_svg]:pointer-events-none [&_svg]:shrink-0",
	FIELD_INSET,
);

/**
 * The closed select: an underline with a chevron at the end, like `Input`. With many choices (language codes, time zones) use a `Combobox`,
 * which can search. `proposal` marks a value the assistant picked and nobody has touched. In a `Select readOnly` it is the value to read, in
 * full ink: no caret at its end, no tint under the pointer, and its list does not open; the keyboard still stops on it, with the focus ring.
 */
function SelectTrigger({
	className,
	size = "default",
	width = "fit",
	proposal = false,
	children,
	...props
}: SelectPrimitive.Trigger.Props & {
	size?: "sm" | "md" | "default";
	/** `full` in a form, beside full-width inputs; `fit` in a toolbar, a filter or at the end of a row (a review's choice, a field's rule). */
	width?: "fit" | "full";
	/** The assistant picked this value and nobody has touched it yet. Turn it off when the value is changed. */
	proposal?: boolean;
}) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			data-width={width}
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				SELECT_TRIGGER,
				"data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-placeholder:text-monti-faint data-proposal:text-monti-proposal data-proposal:focus-visible:ring-2 data-proposal:focus-visible:ring-monti-contrast/60",
				width === "full" ? "w-full" : "w-fit",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon data-slot="select-icon" className="flex">
				<Caret solo className="size-3.5" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({
	className,
	children,
	side = "bottom",
	sideOffset = 4,
	align = "start",
	alignOffset = 0,
	alignItemWithTrigger = false,
	...props
}: SelectPrimitive.Popup.Props &
	Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger">) {
	const placement = usePlacementPadding();
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				collisionPadding={placement}
				style={FIRST_PASS}
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				alignItemWithTrigger={alignItemWithTrigger}
				className="isolate z-50"
			>
				<SelectPrimitive.Popup
					data-slot="select-content"
					data-align-trigger={alignItemWithTrigger}
					className={cn(
						MENU_CARD,
						MENU_MOTION,
						"relative isolate z-50",
						FIT_HEIGHT,
						"w-max min-w-[max(var(--monti-width-menu),var(--anchor-width))] max-w-(--available-width) overflow-y-auto overflow-x-hidden p-monti-4 data-[align-trigger=true]:animate-none",
						className,
					)}
					{...props}
				>
					<SelectScrollUpButton />
					<SelectPrimitive.List>{children}</SelectPrimitive.List>
					<SelectScrollDownButton />
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
	return <SelectPrimitive.GroupLabel data-slot="select-label" className={cn(MENU_LABEL, className)} {...props} />;
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
	return (
		<SelectPrimitive.Item data-slot="select-item" className={cn(MENU_ITEM, "w-full", className)} {...props}>
			<SelectPrimitive.ItemText className="flex min-w-0 flex-1 gap-monti-8 whitespace-nowrap">
				{menuWords(children)}
			</SelectPrimitive.ItemText>
			<SelectPrimitive.ItemIndicator render={<MenuTick />} />
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
	return (
		<SelectPrimitive.Separator
			data-slot="select-separator"
			className={cn("pointer-events-none", MENU_SEPARATOR, className)}
			{...props}
		/>
	);
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
	return (
		<SelectPrimitive.ScrollUpArrow
			data-slot="select-scroll-up-button"
			className={cn(
				"top-0 z-10 flex w-full cursor-default items-center justify-center bg-monti-page py-monti-4 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<ChevronUp />
		</SelectPrimitive.ScrollUpArrow>
	);
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
	return (
		<SelectPrimitive.ScrollDownArrow
			data-slot="select-scroll-down-button"
			className={cn(
				"bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-monti-page py-monti-4 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<ChevronDown />
		</SelectPrimitive.ScrollDownArrow>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
