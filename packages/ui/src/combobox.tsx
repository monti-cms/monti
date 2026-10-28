"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Close } from "@carbon/icons-react";
import * as React from "react";
import { Caret } from "./caret";
import { CHIP, CHIP_REMOVE } from "./chip";
import { cn } from "./cn";
import { ICON_BUTTON } from "./icon-button";
import { Input } from "./input";
import { useUiLabels } from "./labels";
import { MENU_CARD, MENU_ITEM, MENU_LABEL, MENU_MOTION, MENU_SEPARATOR, MenuTick } from "./menu-parts";

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
	return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({ className, ...props }: ComboboxPrimitive.Trigger.Props) {
	return (
		<ComboboxPrimitive.Trigger data-slot="combobox-trigger" className={cn(ICON_BUTTON, className)} {...props}>
			<Caret solo className="size-3.5" />
		</ComboboxPrimitive.Trigger>
	);
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
	const labels = useUiLabels();
	return (
		<ComboboxPrimitive.Clear data-slot="combobox-clear" className={cn(ICON_BUTTON, className)} {...props}>
			<Close className="pointer-events-none" aria-hidden />
			<span className="sr-only">{labels.clear}</span>
		</ComboboxPrimitive.Clear>
	);
}

/** The field of a combobox: an underline like `Input`, with the open button (or, once there is a value, the clear button) at its end. */
function ComboboxInput({
	className,
	children,
	disabled = false,
	showTrigger = true,
	showClear = false,
	size = "default",
	mono = false,
	...props
}: Omit<ComboboxPrimitive.Input.Props, "size"> & {
	showTrigger?: boolean;
	showClear?: boolean;
	size?: "sm" | "default";
	mono?: boolean;
}) {
	return (
		<div
			data-slot="combobox-input"
			className={cn(
				"group/combobox-input flex w-full min-w-0 items-center gap-monti-4 border-monti-default border-b transition-colors focus-within:border-monti-contrast has-[[aria-invalid=true]]:border-monti-danger",
				className,
			)}
		>
			<ComboboxPrimitive.Input
				render={<Input disabled={disabled} size={size} mono={mono} className="flex-1 border-b-0" />}
				{...props}
			/>
			{showTrigger && (
				<ComboboxTrigger disabled={disabled} className="group-has-data-[slot=combobox-clear]/combobox-input:hidden" />
			)}
			{showClear && <ComboboxClear disabled={disabled} />}
			{children}
		</div>
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
						MENU_CARD,
						MENU_MOTION,
						"group/combobox-content relative max-h-(--available-height) w-(--anchor-width) min-w-[calc(var(--anchor-width)+--spacing(7))] max-w-(--available-width) overflow-hidden data-[chips=true]:min-w-(--anchor-width)",
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
				"no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-monti-6 data-empty:p-0",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
	return (
		<ComboboxPrimitive.Item data-slot="combobox-item" className={cn(MENU_ITEM, className)} {...props}>
			{children}
			<ComboboxPrimitive.ItemIndicator render={<MenuTick />} />
		</ComboboxPrimitive.Item>
	);
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
	return <ComboboxPrimitive.Group data-slot="combobox-group" className={cn(className)} {...props} />;
}

function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
	return <ComboboxPrimitive.GroupLabel data-slot="combobox-label" className={cn(MENU_LABEL, className)} {...props} />;
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
	return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
	return (
		<ComboboxPrimitive.Empty
			data-slot="combobox-empty"
			className={cn(
				"hidden w-full justify-center py-monti-8 text-center text-monti-body text-monti-muted group-data-empty/combobox-content:flex",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
	return (
		<ComboboxPrimitive.Separator data-slot="combobox-separator" className={cn(MENU_SEPARATOR, className)} {...props} />
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
				"flex flex-wrap items-center gap-monti-6 border-monti-default border-b py-monti-2 text-monti-body transition-colors focus-within:border-monti-contrast has-aria-invalid:border-monti-danger",
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
	const labels = useUiLabels();
	return (
		<ComboboxPrimitive.Chip
			data-slot="combobox-chip"
			className={cn(
				CHIP,
				"has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-45",
				className,
			)}
			{...props}
		>
			{children}
			{showRemove && (
				<ComboboxPrimitive.ChipRemove className={CHIP_REMOVE} data-slot="combobox-chip-remove">
					<Close className="pointer-events-none size-3" aria-hidden />
					<span className="sr-only">{labels.deselect}</span>
				</ComboboxPrimitive.ChipRemove>
			)}
		</ComboboxPrimitive.Chip>
	);
}

function ComboboxChipsInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
	return (
		<ComboboxPrimitive.Input
			data-slot="combobox-chip-input"
			className={cn("h-7 min-w-16 flex-1 outline-none", className)}
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
