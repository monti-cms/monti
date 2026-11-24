import type * as React from "react";
import { cn } from "./cn";
import { Checkmark } from "./icons";
import { Shortcut, type ShortcutKeys } from "./shortcut";

/**
 * The floating card every menu, picker list and popover is drawn on: paper, a `border-default` line, `radius-lg` (10px) and the floating shadow. A list card adds 4px inside (`p-monti-4`); the parts below are what goes in it.
 * Its rows and buttons are of the square family (`radius-md`): a card that holds buttons says so with `data-shape="square"`.
 */
export const MENU_CARD =
	"flex flex-col rounded-monti-lg border border-monti-default bg-monti-page text-monti-body text-monti-default shadow-monti-floating outline-none";

/**
 * Where a second level starts, measured from the row that opens it: the row sits 5px inside its card (4 padding, 1 border), so 5 + 4 puts the
 * second card 4px clear of the parent's edge. Its first row lines up with the parent row when the card is raised by the same 5px.
 */
export const SUB_SIDE_OFFSET = 9;
export const SUB_ALIGN_OFFSET = -5;

/** How a card opens and closes, whichever side it opens to. */
export const MENU_MOTION =
	"origin-(--transform-origin) duration-(--monti-duration-fast) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-open:animate-in";

/**
 * The row every list draws: a menu, a searchable list and a pick list share it, and each adds how its current row is marked. It stands at the medium
 * control height (32px), the same as a medium field or button, with no padding of its own above or below: the words sit in the middle.
 */
export const MENU_ROW =
	"flex min-h-monti-control-md min-w-0 cursor-default select-none items-center gap-monti-8 rounded-monti-md px-monti-8 text-monti-body text-monti-muted outline-hidden [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-monti-subtle";

/**
 * One row of a menu or picker list (Base UI: menu, select, combobox). The row the pointer or the keyboard is on takes the hover ground (`bg-muted`),
 * and the row whose second level is open the selected one. A row that is the current value of a pick-one list does not: it ends in a {@link MenuTick}.
 */
export const MENU_ITEM = cn(
	MENU_ROW,
	"data-highlighted:bg-monti-muted data-highlighted:text-monti-default data-popup-open:bg-monti-selected data-popup-open:text-monti-default data-disabled:pointer-events-none data-disabled:text-monti-faint data-disabled:[&>svg]:text-monti-faint data-[variant=danger]:text-monti-danger data-[variant=danger]:data-highlighted:text-monti-danger data-[variant=danger]:[&>svg]:text-monti-danger",
);

/**
 * 칸 아래에 여는 고르기 목록(`SelectContent`, `ComboboxList`)의 카드 여백: 옆 2px, 위아래 4px. 목록 카드는 칸의 상자 시작에 서고, 칸의 글자는 그
 * 상자에서 8px 안에 선다(`FIELD_INSET`). 행의 글자도 그 8px에 서도록(테두리 1 + 여백 2 + 행 여백 5) 메뉴 카드의 4px보다 좁다. 가리킨 바탕은
 * 테두리에서 2px 떨어지고 글자 앞에 5px를 남긴다(2026-11-24 소유자: 값과 목록의 글자가 한 시작선).
 */
export const PICK_CARD_PAD = "px-monti-2 py-monti-4";

/** {@link PICK_CARD_PAD} 카드 안의 행과 묶음 이름의 옆 여백: 8 − 2 − 1 = 5px. 행의 ✓도 카드 끝에서 같은 8px 안에서 끝난다. */
export const PICK_ROW_INSET = "px-[calc(var(--monti-space-8)-var(--monti-space-2)-1px)]";

/** {@link PICK_CARD_PAD} 카드의 묶음 사이 선: 메뉴 카드처럼 카드 끝에서 끝까지. */
export const PICK_SEPARATOR = "-mx-monti-2";

/** The same row inside a searchable list (cmdk marks the row it is on with `data-selected`). */
export const COMMAND_ITEM = cn(
	MENU_ROW,
	"data-[selected=true]:bg-monti-muted data-[selected=true]:text-monti-default data-[disabled=true]:pointer-events-none data-[disabled=true]:text-monti-faint data-[variant=danger]:text-monti-danger data-[variant=danger]:data-[selected=true]:text-monti-danger data-[variant=danger]:[&>svg]:text-monti-danger",
);

/** A group's name: 11px 500, faint, with room at the end for a count. */
export const MENU_LABEL = "flex justify-between px-monti-8 pt-monti-8 pb-monti-4 text-monti-micro text-monti-faint";

/** The rule between two groups: edge to edge of the card, 4px above and below. */
export const MENU_SEPARATOR = "-mx-monti-4 my-monti-4 h-px shrink-0 bg-monti-divider";

/** The current value of a pick-one list: a ✓ at the end of the row. */
export const MENU_TICK =
	"ml-auto flex shrink-0 text-monti-default [&_svg]:size-4 [[data-slot=menu-shortcut]+&]:ml-monti-8 [[data-slot=menu-value]+&]:ml-monti-8";

/** The mark on a row that opens a second level. After a value it sits 4px from it. */
export const MENU_SUB_MARK = "ml-auto [[data-slot=menu-value]+&]:ml-monti-4";

/** The search row on top of a list card (a searchable list, a long menu): a magnifier and the words, then a rule, 4px above the first row. It is one medium control high (32px, rule included) like the rows under it, whatever menu it is in. */
export const MENU_SEARCH_ROW =
	"mb-monti-4 flex min-h-monti-control-md items-center gap-monti-8 border-monti-muted border-b px-monti-8 text-monti-default";

/** The magnifier of a {@link MENU_SEARCH_ROW}. */
export const MENU_SEARCH_ICON = "size-3.5 shrink-0 text-monti-subtle";

/** The words of a {@link MENU_SEARCH_ROW}. */
export const MENU_SEARCH_FIELD =
	"min-w-0 flex-1 border-0 bg-transparent p-0 text-monti-body text-monti-default outline-hidden placeholder:text-monti-faint disabled:cursor-default disabled:opacity-45";

/** The line a list card shows when nothing matches: centered, subtle, with room above and below. */
export const MENU_EMPTY = "px-monti-8 py-monti-12 text-center text-monti-body text-monti-subtle";

/** A long list: one column, 320px high at most, scrolling inside. */
/**
 * A menu's scrolling rows. The list reaches 2px into the card's right padding and keeps 3px before its bar, so the bar sits in the middle between
 * the rows and the card's edge (measured in Chrome: the same space on each side of the thumb).
 */
export const MENU_SCROLL = "-mr-monti-2 flex max-h-80 flex-col overflow-y-auto overscroll-contain pr-[3px]";

/** The ✓ of a row that is the current value. */
function MenuTick({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span data-slot="menu-tick" className={cn(MENU_TICK, className)} {...props}>
			<Checkmark aria-hidden />
		</span>
	);
}

/**
 * The end of a row: its key combination in `keys` (`["mod", "shift", "D"]`, written "⇧⌘D" on a Mac and "Ctrl+Shift+D" elsewhere), or other short
 * text as children (a count, why a row cannot be used), in mono. `typed` is what the person can type in the text to get the same thing (a markdown
 * shortcut: "###", "[]", ">"): it is drawn in the row's own sans letters, faint, because mono squeezes a run of "#" into a blur.
 */
function MenuShortcut({
	className,
	keys,
	typed = false,
	children,
	...props
}: React.ComponentProps<"span"> & { keys?: ShortcutKeys; typed?: boolean }) {
	return (
		<span
			data-slot="menu-shortcut"
			data-typed={typed || undefined}
			className={cn(
				"ml-auto shrink-0 whitespace-nowrap text-monti-micro text-monti-subtle data-typed:text-monti-faint data-typed:text-monti-note [[data-slot=menu-value]+&]:ml-monti-8",
				className,
			)}
			{...props}
		>
			{keys ? <Shortcut keys={keys} /> : children}
		</span>
	);
}

/**
 * The current value of a row that opens a second level ("Modified · newest first"), faint, before the ›. A row that shares its name with another
 * row says its `address` here, in mono and subtle (faint fails contrast on a highlighted row), before any words (" · " between them).
 */
function MenuValue({
	className,
	address,
	children,
	...props
}: React.ComponentProps<"span"> & {
	/** What tells this row from another of the same name: typed or copied as it stands (`first-post`). */
	address?: string;
}) {
	return (
		<span
			data-slot="menu-value"
			className={cn("ml-auto shrink-0 whitespace-nowrap text-monti-caption text-monti-subtle", className)}
			{...props}
		>
			{address ? (
				<span data-slot="menu-value-address" className="font-mono text-monti-caption text-monti-subtle">
					{address}
				</span>
			) : null}
			{address && children ? " · " : null}
			{children}
		</span>
	);
}

export { MenuShortcut, MenuTick, MenuValue };
