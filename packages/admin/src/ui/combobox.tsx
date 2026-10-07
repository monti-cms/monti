"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { useTranslator } from "@monti-cms/core/client";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group";
import { uiMessages } from "./messages";

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
	return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({ className, children, ...props }: ComboboxPrimitive.Trigger.Props) {
	return (
		<ComboboxPrimitive.Trigger
			data-slot="combobox-trigger"
			className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
			{...props}
		>
			{children}
			<ChevronDownIcon className="pointer-events-none size-4 text-cms-muted-foreground" />
		</ComboboxPrimitive.Trigger>
	);
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
	const t = useTranslator(uiMessages);
	return (
		<ComboboxPrimitive.Clear
			data-slot="combobox-clear"
			render={<InputGroupButton variant="ghost" size="icon-xs" />}
			className={cn(className)}
			{...props}
		>
			<XIcon className="pointer-events-none" aria-hidden />
			<span className="sr-only">{t("clear")}</span>
		</ComboboxPrimitive.Clear>
	);
}

function ComboboxInput({
	className,
	children,
	disabled = false,
	showTrigger = true,
	showClear = false,
	...props
}: ComboboxPrimitive.Input.Props & {
	showTrigger?: boolean;
	showClear?: boolean;
}) {
	return (
		<InputGroup className={cn("w-auto", className)}>
			<ComboboxPrimitive.Input render={<InputGroupInput disabled={disabled} />} {...props} />
			<InputGroupAddon align="inline-end">
				{showTrigger && (
					<InputGroupButton
						size="icon-xs"
						variant="ghost"
						render={<ComboboxTrigger />}
						data-slot="input-group-button"
						className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
						disabled={disabled}
					/>
				)}
				{showClear && <ComboboxClear disabled={disabled} />}
			</InputGroupAddon>
			{children}
		</InputGroup>
	);
}

function ComboboxContent({
	className,
	side = "bottom",
	sideOffset = 6,
	align = "start",
	alignOffset = 0,
	anchor,
	...props
}: ComboboxPrimitive.Popup.Props &
	Pick<ComboboxPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset" | "anchor">) {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				className="isolate z-50"
			>
				<ComboboxPrimitive.Popup
					data-slot="combobox-content"
					data-chips={!!anchor}
					className={cn(
						"group/combobox-content data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 relative max-h-(--available-height) w-(--anchor-width) min-w-[calc(var(--anchor-width)+--spacing(7))] max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-md bg-cms-popover text-cms-popover-foreground shadow-md ring-1 ring-cms-foreground/10 duration-100 data-[chips=true]:min-w-(--anchor-width) data-closed:animate-out data-open:animate-in *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-cms-input/30 *:data-[slot=input-group]:bg-cms-input/30 *:data-[slot=input-group]:shadow-none",
						className,
					)}
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
	return (
		<ComboboxPrimitive.List
			data-slot="combobox-list"
			className={cn(
				"no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
	return (
		<ComboboxPrimitive.Item
			data-slot="combobox-item"
			className={cn(
				"relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-cms-accent data-highlighted:text-cms-accent-foreground data-disabled:opacity-50 not-data-[variant=destructive]:data-highlighted:**:text-cms-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{children}
			<ComboboxPrimitive.ItemIndicator
				render={<span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />}
			>
				<CheckIcon className="pointer-events-none" />
			</ComboboxPrimitive.ItemIndicator>
		</ComboboxPrimitive.Item>
	);
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
	return <ComboboxPrimitive.Group data-slot="combobox-group" className={cn(className)} {...props} />;
}

function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
	return (
		<ComboboxPrimitive.GroupLabel
			data-slot="combobox-label"
			className={cn("px-2 py-1.5 text-cms-muted-foreground text-xs", className)}
			{...props}
		/>
	);
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
	return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
	return (
		<ComboboxPrimitive.Empty
			data-slot="combobox-empty"
			className={cn(
				"hidden w-full justify-center py-2 text-center text-cms-muted-foreground text-sm group-data-empty/combobox-content:flex",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
	return (
		<ComboboxPrimitive.Separator
			data-slot="combobox-separator"
			className={cn("-mx-1 my-1 h-px bg-cms-border", className)}
			{...props}
		/>
	);
}

function ComboboxChips({
	className,
	...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> & ComboboxPrimitive.Chips.Props) {
	return (
		<ComboboxPrimitive.Chips
			data-slot="combobox-chips"
			className={cn(
				"flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-cms-input bg-transparent cms-dark:bg-cms-input/30 bg-clip-padding px-2.5 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-cms-ring focus-within:ring-3 focus-within:ring-cms-ring/50 cms-dark:has-aria-invalid:border-cms-destructive/50 has-aria-invalid:border-cms-destructive has-data-[slot=combobox-chip]:px-1.5 cms-dark:has-aria-invalid:ring-cms-destructive/40 has-aria-invalid:ring-3 has-aria-invalid:ring-cms-destructive/20",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxChip({
	className,
	children,
	showRemove = true,
	...props
}: ComboboxPrimitive.Chip.Props & {
	showRemove?: boolean;
}) {
	const t = useTranslator(uiMessages);
	return (
		<ComboboxPrimitive.Chip
			data-slot="combobox-chip"
			className={cn(
				"flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 whitespace-nowrap rounded-sm bg-cms-muted px-1.5 font-medium text-cms-foreground text-xs has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-data-[slot=combobox-chip-remove]:pr-0 has-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			{children}
			{showRemove && (
				<ComboboxPrimitive.ChipRemove
					render={<Button variant="ghost" size="icon-xs" />}
					className="-ml-1 opacity-50 hover:opacity-100"
					data-slot="combobox-chip-remove"
				>
					<XIcon className="pointer-events-none" aria-hidden />
					<span className="sr-only">{t("deselect")}</span>
				</ComboboxPrimitive.ChipRemove>
			)}
		</ComboboxPrimitive.Chip>
	);
}

function ComboboxChipsInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
	return (
		<ComboboxPrimitive.Input
			data-slot="combobox-chip-input"
			className={cn("min-w-16 flex-1 outline-none", className)}
			{...props}
		/>
	);
}

function useComboboxAnchor() {
	return React.useRef<HTMLDivElement | null>(null);
}

export {
	Combobox,
	ComboboxInput,
	ComboboxContent,
	ComboboxList,
	ComboboxItem,
	ComboboxGroup,
	ComboboxLabel,
	ComboboxCollection,
	ComboboxEmpty,
	ComboboxSeparator,
	ComboboxChips,
	ComboboxChip,
	ComboboxChipsInput,
	ComboboxTrigger,
	ComboboxValue,
	useComboboxAnchor,
};
