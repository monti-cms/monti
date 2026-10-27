"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type * as React from "react";
import { Caret } from "./caret";
import { cn } from "./cn";
import { MENU_CARD, MENU_ITEM, MENU_LABEL, MENU_MOTION, MENU_SEPARATOR, MenuTick } from "./menu-parts";

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
	return <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1 p-1", className)} {...props} />;
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
	return (
		<SelectPrimitive.Value data-slot="select-value" className={cn("flex flex-1 text-left", className)} {...props} />
	);
}

/**
 * The closed select: an underline with a chevron at the end, like `Input`. With many choices (language codes, time zones) use a `Combobox`,
 * which can search. `proposal` marks a value the assistant picked and nobody has touched.
 */
function SelectTrigger({
	className,
	size = "default",
	width = "fit",
	proposal = false,
	children,
	...props
}: SelectPrimitive.Trigger.Props & {
	size?: "sm" | "default";
	/** `full` in a form, beside full-width inputs; `fit` in a toolbar or a filter. */
	width?: "fit" | "full";
	/** The assistant picked this value and nobody has touched it yet. Turn it off when the value is changed. */
	proposal?: boolean;
}) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			data-proposal={proposal || undefined}
			className={cn(
				"flex items-center justify-between gap-monti-8 whitespace-nowrap rounded-none border-0 border-monti-default border-b bg-transparent text-left text-monti-body text-monti-default outline-none transition-colors focus-visible:border-monti-contrast disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-[size=default]:py-monti-6 data-[size=sm]:py-monti-4 data-[size=sm]:text-monti-note data-placeholder:text-monti-faint data-proposal:text-monti-proposal *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-monti-6 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				width === "full" ? "w-full" : "w-fit",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon className="flex">
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
	align = "center",
	alignOffset = 0,
	alignItemWithTrigger = true,
	...props
}: SelectPrimitive.Popup.Props &
	Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger">) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
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
						"relative isolate z-50 max-h-(--available-height) w-max min-w-[max(9rem,var(--anchor-width))] max-w-(--available-width) overflow-y-auto overflow-x-hidden p-monti-6 data-[align-trigger=true]:animate-none",
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
			<SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
				{children}
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
				"top-0 z-10 flex w-full cursor-default items-center justify-center bg-monti-page py-1 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<ChevronUpIcon />
		</SelectPrimitive.ScrollUpArrow>
	);
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
	return (
		<SelectPrimitive.ScrollDownArrow
			data-slot="select-scroll-down-button"
			className={cn(
				"bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-monti-page py-1 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<ChevronDownIcon />
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
