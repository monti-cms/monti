"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import * as React from "react";
import { Caret } from "./caret";
import { CHIP, CHIP_REMOVABLE, CHIP_REMOVE, CHIP_SM, CHIPS_FIELD, CHIPS_INPUT } from "./chip";
import { cn } from "./cn";
import { FIELD_HOVER, FIELD_INSET } from "./hover";
import { ICON_BUTTON } from "./icon-button";
import { Close } from "./icons";
import { Input } from "./input";
import { useUiLabels } from "./labels";
import { MENU_CARD, MENU_EMPTY, MENU_ITEM, MENU_LABEL, MENU_MOTION, MENU_SEPARATOR, MenuTick } from "./menu-parts";

/**
 * The combobox. `readOnly` is a value to read, the same in a field of one and of many: full ink, the keyboard stops on it and its words can be
 * picked and copied, and nothing changes it (no typing, no list, no clear, no × on a chip).
 */
const Combobox = ((props: ComboboxPrimitive.Root.Props<unknown, boolean | undefined>) => (
	<ComboboxPrimitive.Root
		{...props}
		// Base UI's own read-only list opens to be looked through: here the opening is refused. `open` is left as it was given: whether it is
		// held from outside is settled on the first drawing, so a field that turns read-only, or stops being it, would keep the wrong one.
		onOpenChange={(next, details) => {
			if (props.readOnly && next) {
				details.cancel();
				return;
			}
			props.onOpenChange?.(next, details);
		}}
	/>
)) as typeof ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
	return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({ className, ...props }: ComboboxPrimitive.Trigger.Props) {
	return (
		<ComboboxPrimitive.Trigger
			data-slot="combobox-trigger"
			className={cn(
				ICON_BUTTON,
				"w-auto not-disabled:hover:bg-transparent not-disabled:active:bg-transparent aria-expanded:bg-transparent",
				className,
			)}
			{...props}
		>
			<Caret solo className="size-3.5" />
		</ComboboxPrimitive.Trigger>
	);
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
	const labels = useUiLabels();
	return (
		<ComboboxPrimitive.Clear
			data-slot="combobox-clear"
			className={cn(
				ICON_BUTTON,
				"w-auto not-disabled:hover:bg-transparent not-disabled:active:bg-transparent aria-expanded:bg-transparent",
				className,
			)}
			{...props}
		>
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
	proposal = false,
	...props
}: Omit<ComboboxPrimitive.Input.Props, "size"> & {
	showTrigger?: boolean;
	showClear?: boolean;
	size?: "sm" | "md" | "default";
	mono?: boolean;
	/** The picked value is one the assistant chose and nobody has touched: blue text and a 1.5px blue line, as `Input proposal`. */
	proposal?: boolean;
}) {
	return (
		<div
			data-slot="combobox-input"
			className={cn(
				cn(
					FIELD_HOVER,
					"group/combobox-input flex w-full min-w-0 items-center gap-monti-4 border-monti-strong border-b transition-colors focus-within:border-monti-contrast has-[input[readonly]]:has-focus-visible:ring-2 has-[input[readonly]]:has-focus-visible:ring-monti-contrast/50 has-[input:disabled]:pointer-events-none has-[[aria-invalid=true]]:border-monti-danger has-data-proposal:border-monti-proposal has-data-proposal:border-b-[1.5px] has-[input:disabled]:opacity-45 has-[input[readonly]]:focus-within:border-monti-default",
					FIELD_INSET,
				),
				size === "sm" ? "h-monti-control-sm" : size === "md" ? "h-monti-control-md" : "h-monti-control-lg",
				className,
			)}
		>
			<ComboboxPrimitive.Input
				// A combobox that is off (`Combobox disabled`) marks its input but leaves it in the Tab order: the input itself is turned off here, so the field is
				// off for the keyboard too, as an `Input disabled` is.
				render={(given, state) => (
					<Input
						{...given}
						disabled={disabled || state.disabled}
						size={size}
						mono={mono}
						proposal={proposal}
						// The field around it holds the room, the tint and the dimming of a field that is off; the input inside takes none of them.
						className={cn(
							"h-full flex-1 border-b-0 px-0 hover:bg-transparent disabled:opacity-100 data-proposal:border-b-0",
							given.className,
						)}
					/>
				)}
				{...props}
			/>
			{showTrigger && (
				<ComboboxTrigger
					disabled={disabled || undefined}
					// The field dims everything in it once: its buttons do not dim again.
					className="disabled:opacity-100 group-has-[input[readonly]]/combobox-input:hidden group-has-data-[slot=combobox-clear]/combobox-input:hidden"
				/>
			)}
			{showClear && (
				<ComboboxClear
					disabled={disabled || undefined}
					// Nothing clears a value that is only read.
					className="disabled:opacity-100 group-has-[input[readonly]]/combobox-input:hidden"
				/>
			)}
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
			className={cn(MENU_EMPTY, "hidden w-full justify-center group-data-empty/combobox-content:flex", className)}
			{...props}
		/>
	);
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
	return (
		<ComboboxPrimitive.Separator data-slot="combobox-separator" className={cn(MENU_SEPARATOR, className)} {...props} />
	);
}

/** The words of the chips of one field, by their ids: what a read-only field's input is described by. */
const ChipLabels = React.createContext<{ ids: string[]; add: (id: string) => () => void } | null>(null);

function ComboboxChips({
	size = "default",
	proposal = false,
	className,
	...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
	ComboboxPrimitive.Chips.Props & {
		/** `sm` stands 28px high, as a small `ComboboxInput` does. */
		size?: "sm" | "md" | "default";
		/**
		 * The picked values are ones the assistant chose and nobody has touched: the 1.5px blue line of `Input proposal`, and each chip in the
		 * proposal colors, its × in the same blue (as `Chip proposal`, without its spark: the label row says whose they are).
		 */
		proposal?: boolean;
	}) {
	const [ids, setIds] = React.useState<string[]>([]);
	// One `add` for the field's life: a chip puts its id in once, and takes it out when it goes.
	const add = React.useCallback((id: string) => {
		// In the order the chips stand in the field, whenever each came: the values are said as they are read.
		const inOrder = (all: string[]) =>
			[...all].sort((a, b) => {
				const [first, second] = [document.getElementById(a), document.getElementById(b)];
				if (!first || !second) return 0;
				return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
			});
		setIds((was) => inOrder([...was, id]));
		return () => setIds((was) => was.filter((each) => each !== id));
	}, []);
	const labels = React.useMemo(() => ({ ids, add }), [ids, add]);
	return (
		<ChipLabels.Provider value={labels}>
			<ComboboxChipsField size={size} proposal={proposal} className={className} {...props} />
		</ChipLabels.Provider>
	);
}

function ComboboxChipsField({
	size,
	proposal,
	className,
	...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
	ComboboxPrimitive.Chips.Props & { size: "sm" | "md" | "default"; proposal: boolean }) {
	return (
		<ComboboxPrimitive.Chips
			data-slot="combobox-chips"
			data-size={size}
			data-proposal={proposal || undefined}
			className={cn(
				CHIPS_FIELD,
				// A field that is off looks off, as `ComboboxInput` does: dimmed once, chips and all, and nothing in it answers the pointer.
				"has-[input:disabled]:pointer-events-none has-[input:disabled]:cursor-default has-[input:disabled]:opacity-45",
				// Read only: the values in full ink with no × on them, and the keyboard's focus is a ring (nothing is typed, so no caret shows it).
				"has-[input[readonly]]:has-focus-visible:ring-2 has-[input[readonly]]:has-focus-visible:ring-monti-contrast/50 has-[input[readonly]]:focus-within:border-monti-default has-[input[readonly]]:**:data-[slot=combobox-chip-remove]:hidden",
				// The proposal's line keeps its color under the pointer and with the focus, as a proposed `Input`'s does.
				"data-proposal:border-monti-proposal! data-proposal:border-b-[1.5px] data-proposal:**:data-[slot=combobox-chip]:bg-monti-proposal-muted data-proposal:**:data-[slot=combobox-chip-remove]:text-monti-proposal data-proposal:**:data-[slot=combobox-chip]:text-monti-proposal",
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
	const id = React.useId();
	const add = React.useContext(ChipLabels)?.add;
	React.useEffect(() => add?.(id), [add, id]);
	return (
		<ComboboxPrimitive.Chip
			data-slot="combobox-chip"
			// The small chip (24px), as `TagInput`'s, so a row of chips stands in the field's own height.
			className={cn(
				CHIP,
				CHIP_SM,
				CHIP_REMOVABLE,
				// The field around it dims a field that is off once: its chips do not dim again.
				"not-aria-readonly:has-disabled:pointer-events-none has-disabled:cursor-default",
				// A chip that is only read answers the pointer as words do: they can be picked, and it takes no tint.
				"aria-readonly:cursor-text aria-readonly:select-text aria-readonly:hover:bg-monti-selected",
				className,
			)}
			{...props}
		>
			<span id={id}>{children}</span>
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
	const chips = React.useContext(ChipLabels)?.ids ?? [];
	return (
		<ComboboxPrimitive.Input
			data-slot="combobox-chip-input"
			className={cn(CHIPS_INPUT, className)}
			// In a field that is only read the keyboard stops on this input, which holds nothing, and does not walk the chips: the values
			// are said with it, as its description.
			render={(given, state) => (
				<input
					{...given}
					aria-describedby={
						state.readOnly && chips.length > 0
							? [given["aria-describedby"], ...chips].filter(Boolean).join(" ")
							: given["aria-describedby"]
					}
				/>
			)}
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
