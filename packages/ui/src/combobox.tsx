"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import * as React from "react";
import { Caret } from "./caret";
import { CHIP, CHIP_REMOVABLE, CHIP_REMOVE, CHIP_SM, CHIPS_FIELD, CHIPS_INPUT } from "./chip";
import { cn } from "./cn";
import { FIELD_HOVER, FIELD_INSET, FIELD_LEAD } from "./hover";
import { ICON_BUTTON } from "./icon-button";
import { Add, Close } from "./icons";
import { Input } from "./input";
import { useUiLabels } from "./labels";
import {
	MENU_CARD,
	MENU_EMPTY,
	MENU_ITEM,
	MENU_LABEL,
	MENU_MOTION,
	MENU_SEPARATOR,
	MenuTick,
	PICK_CARD_PAD,
	PICK_ROW_INSET,
	PICK_SEPARATOR,
} from "./menu-parts";
import { menuWords } from "./menu-words";
import { FIRST_PASS, FIT_HEIGHT, FIT_LIST, usePlacementPadding } from "./placement";

/**
 * The combobox. `readOnly` is a value to read, the same in a field of one and of many: full ink, the keyboard stops on it and its words can be
 * picked and copied, and nothing changes it (no typing, no list, no clear, no × on a chip).
 */
/** The field's own box (the element that draws the underline), where a `ComboboxContent width="field"` stands. */
const ComboboxFieldContext = React.createContext<React.RefObject<HTMLDivElement | null> | null>(null);

const Combobox = ((props: ComboboxPrimitive.Root.Props<unknown, boolean | undefined>) => (
	<ComboboxField>
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
	</ComboboxField>
)) as typeof ComboboxPrimitive.Root;

function ComboboxField({ children }: { children: React.ReactNode }) {
	const field = React.useRef<HTMLDivElement | null>(null);
	return <ComboboxFieldContext.Provider value={field}>{children}</ComboboxFieldContext.Provider>;
}

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
	icon,
	...props
}: Omit<ComboboxPrimitive.Input.Props, "size"> & {
	/**
	 * A 14px mark before the words, 8px from them, in the faint ink (the magnifier of a field that finds). It stands in the input's own room, so the
	 * list still opens from the field's start.
	 */
	icon?: React.ReactNode;
	showTrigger?: boolean;
	showClear?: boolean;
	size?: "sm" | "md" | "default";
	mono?: boolean;
	/** The picked value is one the assistant chose and nobody has touched: blue text and a 1.5px blue line, as `Input proposal`. */
	proposal?: boolean;
}) {
	const field = React.useContext(ComboboxFieldContext);
	return (
		<div
			ref={field}
			data-slot="combobox-input"
			className={cn(
				cn(
					FIELD_HOVER,
					"group/combobox-input relative flex w-full min-w-0 items-center gap-monti-4 border-transparent border-b transition-colors focus-within:border-monti-contrast has-[input[readonly]]:has-focus-visible:ring-2 has-[input[readonly]]:has-focus-visible:ring-monti-contrast/60 has-[input:disabled]:pointer-events-none has-[[aria-invalid=true]]:border-monti-danger has-data-proposal:border-monti-proposal has-data-proposal:border-b-[1.5px] has-[input:disabled]:opacity-45 has-[input[readonly]]:focus-within:border-transparent",
					FIELD_INSET,
				),
				size === "sm" ? "h-monti-control-sm" : "h-monti-control-md",
				className,
			)}
		>
			{icon && (
				<span
					data-slot="combobox-icon"
					className={cn("pointer-events-none absolute flex text-monti-faint [&_svg]:size-3.5", FIELD_LEAD)}
				>
					{icon}
				</span>
			)}
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
							icon && "pl-[22px]",
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
	alignOffset,
	anchor,
	width = "default",
	...props
}: ComboboxPrimitive.Popup.Props &
	Pick<ComboboxPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset" | "anchor"> & {
		/**
		 * 어느 쪽이든 목록은 칸의 상자 시작에서 칸과 같은 폭으로 연다. 칸 안에서 글자가 어디서 시작하든 상자는 칸 밖으로 나가지 않고, 행의 글자는
		 * 상자에서 8px 안(칸의 `FIELD_INSET`과 같은 줄)에 선다({@link PICK_CARD_PAD}, 2026-11-24 소유자). `field`: 대화상자의 칸에 딸린 목록(API 키
		 * 대화상자의 서비스 고르기). Its rows are 13px in ink, its group names 12px on a 28px row, and its rules stand inside the card's padding, as wide
		 * as the rows.
		 */
		width?: "default" | "field";
	}) {
	const placement = usePlacementPadding();
	const field = React.useContext(ComboboxFieldContext);
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				collisionPadding={placement}
				style={FIRST_PASS}
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				// 목록은 칸의 글자가 아니라 칸의 상자 아래에 선다: 글자의 안쪽 여백(`FIELD_INSET`)은 자리마다 다르다.
				anchor={anchor ?? field ?? undefined}
				className="isolate z-50"
			>
				<ComboboxPrimitive.Popup
					data-slot="combobox-content"
					data-chips={!!anchor}
					data-width={width}
					className={cn(
						MENU_CARD,
						MENU_MOTION,
						"group/combobox-content relative",
						FIT_HEIGHT,
						"w-(--anchor-width) max-w-(--available-width) overflow-hidden",
						className,
					)}
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList({
	className,
	fit = "scroll",
	...props
}: ComboboxPrimitive.List.Props & {
	/**
	 * `scroll`: the whole list scrolls, up to 252px. `content`: the list stands at its full height and only a long group inside it scrolls, in a
	 * {@link ComboboxScroll}: the few rows above it (the often used) and the row under it (the way out of the list) stay in view.
	 */
	fit?: "scroll" | "content";
}) {
	return (
		<ComboboxPrimitive.List
			data-slot="combobox-list"
			className={cn(
				PICK_CARD_PAD,
				"data-empty:p-0",
				fit === "scroll" && cn("no-scrollbar scroll-py-1 overflow-y-auto overscroll-contain", FIT_LIST),
				className,
			)}
			{...props}
		/>
	);
}

/** The long group of a `ComboboxList fit="content"`: it scrolls by itself, up to 252px, and its last rows fade out so the list reads as going on. */
function ComboboxScroll({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="combobox-scroll"
			className={cn(
				"no-scrollbar mask-b-from-85% mask-b-to-100% max-h-[252px] scroll-py-1 overflow-y-auto overscroll-contain",
				className,
			)}
			{...props}
		/>
	);
}

/** A row and a group name in a `ComboboxContent width="field"` (see there). */
const PICKER_ITEM =
	"group-data-[width=field]/combobox-content:[&>[data-slot=menu-value]]:text-monti-faint group-data-[width=field]/combobox-content:font-normal group-data-[width=field]/combobox-content:text-monti-default group-data-[width=field]/combobox-content:text-monti-label";
const PICKER_LABEL =
	"group-data-[width=field]/combobox-content:text-monti-caption group-data-[width=field]/combobox-content:font-medium";

function ComboboxItem({
	className,
	tone,
	children,
	...props
}: ComboboxPrimitive.Item.Props & {
	/**
	 * `exit`: the row that leads out of the list ("목록에 없나요? …", under the last separator of a `width="field"` list), a step quieter than the
	 * values: muted words, a 14px faint icon 10px before them (시안 `keys7-add.html`).
	 */
	tone?: "exit";
}) {
	return (
		<ComboboxPrimitive.Item
			data-slot="combobox-item"
			data-tone={tone}
			className={cn(
				MENU_ITEM,
				PICK_ROW_INSET,
				PICKER_ITEM,
				"data-[tone=exit]:gap-monti-10 group-data-[width=field]/combobox-content:data-[tone=exit]:not-data-highlighted:text-monti-muted data-[tone=exit]:[&>svg]:size-3.5 data-[tone=exit]:[&>svg]:text-monti-faint",
				className,
			)}
			{...props}
		>
			{menuWords(children)}
			<ComboboxPrimitive.ItemIndicator render={<MenuTick />} />
		</ComboboxPrimitive.Item>
	);
}

/**
 * The row that makes a new value of the typed words ("New tag: Spring"), the last row of the list. It is not a value of the list: an Add icon
 * and a rule above it say so, and it stands apart from a value of the same name.
 */
function ComboboxCreate({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
	return (
		<ComboboxPrimitive.Item
			data-slot="combobox-create"
			className={cn(
				MENU_ITEM,
				PICK_ROW_INSET,
				"relative mt-monti-8 before:pointer-events-none before:absolute before:inset-x-monti-2 before:-top-[5px] before:h-px before:bg-monti-divider first:mt-0 first:before:hidden",
				className,
			)}
			{...props}
		>
			<Add aria-hidden />
			{menuWords(children)}
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
			className={cn(MENU_LABEL, PICK_ROW_INSET, PICKER_LABEL, className)}
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
			className={cn(MENU_EMPTY, "hidden w-full justify-center group-data-empty/combobox-content:flex", className)}
			{...props}
		/>
	);
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
	return (
		<ComboboxPrimitive.Separator
			data-slot="combobox-separator"
			className={cn(MENU_SEPARATOR, PICK_SEPARATOR, "group-data-[width=field]/combobox-content:mx-0", className)}
			{...props}
		/>
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
	children,
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
				"has-[input[readonly]]:has-focus-visible:ring-2 has-[input[readonly]]:has-focus-visible:ring-monti-contrast/60 has-[input[readonly]]:focus-within:border-transparent has-[input[readonly]]:**:data-[slot=combobox-chip-remove]:hidden",
				// The proposal's line keeps its color under the pointer and with the focus, as a proposed `Input`'s does.
				"data-proposal:border-monti-proposal! data-proposal:border-b-[1.5px] data-proposal:**:data-[slot=combobox-chip]:bg-monti-proposal-muted data-proposal:**:data-[slot=combobox-chip-remove]:text-monti-proposal data-proposal:**:data-[slot=combobox-chip]:text-monti-proposal",
				// The open button stands at the first line's end whatever the chips do: the room for it is the field's own padding.
				"group/chips relative pr-monti-32",
				// 속성 패널의 줄에서는 칩 사이가 4px다(시안 v5 `panel-extreme.html`: 태그가 한 줄에 넷).
				"in-data-[slot=property-row]:gap-monti-4",
				className,
			)}
			{...props}
		>
			{children}
			{/* The open button of every combobox, a field of one value or of many: at the end of the first line. Nothing opens a list that is only read. */}
			{/* 속성 패널의 줄(`PropertyRow`)에서는 여는 버튼의 상자가 칸의 끝(패널의 끝선)에서 끝난다. 갈매기는 상자 안에 서고 가리킨 바탕은 선을 넘지 않는다(2026-11-24 소유자). */}
			<span className="pointer-events-none absolute top-0 in-data-[slot=property-row]:right-0 right-monti-4 flex h-[calc(var(--monti-height-control-md)-1px)] items-center group-has-[input[readonly]]/chips:hidden group-data-[size=md]/chips:h-[calc(var(--monti-height-control-md)-1px)] group-data-[size=sm]/chips:h-[calc(var(--monti-height-control-sm)-1px)]">
				<ComboboxTrigger className="pointer-events-auto size-monti-control-xs disabled:opacity-100" />
			</span>
		</ComboboxPrimitive.Chips>
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
			// 속성 패널의 줄에서는 치는 자리가 친 글자만큼만 자리를 요구한다: 친 글자는 칩 뒤 같은 줄에 서고, 비어 있으면 칩 아래 빈 줄을 만들지
			// 않는다(시안 v5 `panel-states.html` ③ · `panel-extreme.html`, 2026-11-24).
			className={cn(
				CHIPS_INPUT,
				"in-data-[slot=property-row]:field-sizing-content in-data-[slot=property-row]:min-w-auto",
				className,
			)}
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
	ComboboxCreate,
	ComboboxItem,
	ComboboxGroup,
	ComboboxLabel,
	ComboboxCollection,
	ComboboxEmpty,
	ComboboxScroll,
	ComboboxSeparator,
	ComboboxChips,
	ComboboxChip,
	ComboboxChipsInput,
	ComboboxTrigger,
	ComboboxValue,
	useComboboxAnchor,
};
