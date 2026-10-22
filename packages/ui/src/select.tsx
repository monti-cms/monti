"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "./cn";

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
	return <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1 p-1", className)} {...props} />;
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
	return (
		<SelectPrimitive.Value data-slot="select-value" className={cn("flex flex-1 text-left", className)} {...props} />
	);
}

function SelectTrigger({
	className,
	size = "default",
	width = "fit",
	variant = "default",
	children,
	...props
}: SelectPrimitive.Trigger.Props & {
	size?: "sm" | "default";
	/** `full` in a form, beside full-width inputs; `fit` in a toolbar or a filter. */
	width?: "fit" | "full";
	/** `ghost` drops the border until hovered (a select in a footer or a sentence). */
	variant?: "default" | "ghost";
}) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			className={cn(
				"flex items-center justify-between gap-1.5 whitespace-nowrap rounded-md border border-monti-default bg-transparent py-2 pr-2 pl-2.5 text-monti-body outline-none transition-[color,box-shadow] focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger-soft data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=sm]:text-monti-label data-placeholder:text-monti-muted *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				width === "full" ? "w-full" : "w-fit",
				variant === "ghost" && "border-transparent hover:bg-monti-hover",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon render={<ChevronDownIcon className="pointer-events-none size-4 text-monti-muted" />} />
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
						"data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 relative isolate z-50 max-h-(--available-height) w-max min-w-[max(9rem,var(--anchor-width))] max-w-(--available-width) origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-lg border border-monti-muted bg-monti-overlay text-monti-default shadow-monti-floating duration-100 data-[align-trigger=true]:animate-none data-closed:animate-out data-open:animate-in",
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
	return (
		<SelectPrimitive.GroupLabel
			data-slot="select-label"
			className={cn("px-2 py-1.5 text-monti-caption text-monti-muted", className)}
			{...props}
		/>
	);
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				"relative flex w-full cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-monti-label outline-hidden focus:bg-monti-hover focus:text-monti-default focus:**:text-monti-default data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
				className,
			)}
			{...props}
		>
			<SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
				{children}
			</SelectPrimitive.ItemText>
			<SelectPrimitive.ItemIndicator
				render={<span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />}
			>
				<CheckIcon className="pointer-events-none" />
			</SelectPrimitive.ItemIndicator>
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
	return (
		<SelectPrimitive.Separator
			data-slot="select-separator"
			className={cn("pointer-events-none -mx-1 my-1 h-px bg-monti-divider", className)}
			{...props}
		/>
	);
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
	return (
		<SelectPrimitive.ScrollUpArrow
			data-slot="select-scroll-up-button"
			className={cn(
				"top-0 z-10 flex w-full cursor-default items-center justify-center bg-monti-overlay py-1 [&_svg:not([class*='size-'])]:size-4",
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
				"bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-monti-overlay py-1 [&_svg:not([class*='size-'])]:size-4",
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
