"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Caret } from "./caret";
import { cn } from "./cn";
import { HIT_AREA } from "./hit-area";
import { TEXT_HOVER } from "./hover";
import { ArrowDown, ArrowUp } from "./icons";

/**
 * A condition that is not on yet, in a filter row: its name and a caret, opening a list of values (tag ▾, language ▾, sort ▾). Once a value is
 * picked it becomes a `Chip`, or, with `dot`, stays where it is with a dot after its name. With `filled` it shows a value that is set, in ink (a setting's "after 30 days ▾"). Open a menu or popover from it with `render` on the trigger: `<DropdownMenuTrigger render={<FilterButton />}>`.
 */
function FilterButton({
	filled = false,
	dot = false,
	size = "inherit",
	sort,
	className,
	children,
	...props
}: ButtonPrimitive.Props & {
	/** It shows a value that is set ("after 30 days ▾"), in ink rather than the subtle gray of a condition not on yet. */
	filled?: boolean;
	/** A filter is on and its button stays: its name is in ink with a dot after it, as a list's column name has (the menu's ticks say which). */
	dot?: boolean;
	/**
	 * `caption`: in a 36px head row (the media library's), 12px at 500, faint until pointed at, its caret 2px after the name. 켜진 필터의 `FilterChip`과
	 * 한 짜임이다: 24px 상자(`radius-md`)가 줄의 시작 선에서 시작하고 글자는 그 안 8px에 선다. 가리킨 바탕은 그 상자이고 밖으로 나가지 않는다. 그래서
	 * 필터를 켜고 꺼도 이름의 x와 y가 같다(2026-11-24 소유자).
	 */
	size?: "inherit" | "caption";
	/** The order this button sets, shown in place of the caret: in ink with ↓ or ↑ ("올린 날 ↓"). */
	sort?: "asc" | "desc";
}) {
	return (
		<ButtonPrimitive
			data-slot="filter-button"
			type="button"
			className={cn(
				"inline-flex cursor-pointer items-center border-0 bg-transparent p-0 outline-none not-disabled:hover:text-monti-default disabled:pointer-events-none disabled:opacity-45 aria-expanded:text-monti-default",
				size === "caption"
					? "h-monti-control-xs rounded-monti-md px-monti-8 not-disabled:hover:bg-monti-muted focus-visible:ring-2 focus-visible:ring-monti-contrast/60 not-disabled:active:bg-monti-selected aria-expanded:bg-monti-selected"
					: cn(TEXT_HOVER, HIT_AREA, "rounded-monti-full"),
				filled || dot || sort ? "text-monti-default" : size === "caption" ? "text-monti-faint" : "text-monti-subtle",
				size === "caption" &&
					"gap-monti-2 font-medium text-monti-caption [&>[data-slot=caret]]:ml-0 [&>[data-slot=caret]]:text-monti-faint [&>[data-slot=caret]]:opacity-70 [&>svg:not([data-slot])]:size-3",
				sort && "gap-monti-4",
				className,
			)}
			{...props}
		>
			{children}
			{dot && (
				<span
					aria-hidden
					data-slot="filter-dot"
					className="ml-monti-4 size-[5px] shrink-0 rounded-monti-full bg-monti-emphasis"
				/>
			)}
			{sort === "desc" ? <ArrowDown aria-hidden /> : sort === "asc" ? <ArrowUp aria-hidden /> : <Caret />}
		</ButtonPrimitive>
	);
}

export { FilterButton };
