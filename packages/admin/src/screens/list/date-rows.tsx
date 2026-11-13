import type { DateRange } from "@monti-cms/core";
import {
	Calendar,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	MenuValue,
} from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { shortDate } from "./format";

const iso = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromIso = (value: string) => {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

/**
 * The days a date column is filtered by, in every table's column menu (the entry list's dates, the activity log's time): all dates, today, 7 days,
 * 30 days, one day, or a range (2026-11-06 owner, after other products: a day and a range are separate rows, and "all dates" is the way out). One
 * day is picked with one press on its calendar; a range's first press starts it and the next one ends it and applies it. Both calendars stay open
 * showing what is on. Like every row with a ›, the day or range that is on is written before it (menu.md).
 */
export function DateRows({
	range,
	onChange,
}: {
	range: DateRange | null;
	onChange: (range: DateRange | null) => void;
}) {
	const { t, language } = useAdmin();
	const fixed = typeof range === "string" ? range : null;
	const day = range !== null && typeof range !== "string" && range.from === range.to ? range.from : null;
	const span = range !== null && typeof range !== "string" && range.from !== range.to ? range : null;
	const [start, setStart] = useState<Date | null>(null);
	const picked =
		start !== null
			? { from: start, to: undefined }
			: span
				? { from: fromIso(span.from), to: fromIso(span.to) }
				: undefined;
	const apply = (next: DateRange | null) => {
		setStart(null);
		onChange(next);
	};
	// Each row says which way of filtering is on; "all dates" is on when none is.
	const on = fixed ?? (day ? "day" : span ? "range" : "all");
	return (
		<>
			<DropdownMenuRadioGroup
				value={on === "day" || on === "range" ? "" : on}
				onValueChange={(value) => apply(value === "all" ? null : (value as "today" | "7d" | "30d"))}
			>
				<DropdownMenuRadioItem value="all" closeOnClick={false}>
					{t("list.allDates")}
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="today" closeOnClick={false}>
					{t("list.today")}
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="7d" closeOnClick={false}>
					{t("list.last7")}
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="30d" closeOnClick={false}>
					{t("list.last30")}
				</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
			<DropdownMenuSub>
				<DropdownMenuSubTrigger>
					{t("list.pickDay")}
					{day && <MenuValue>{shortDate(fromIso(day))}</MenuValue>}
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent bare>
					<Calendar
						mode="single"
						language={language}
						selected={day ? fromIso(day) : undefined}
						defaultMonth={day ? fromIso(day) : undefined}
						onSelect={(next) => {
							if (next) apply({ from: iso(next), to: iso(next) });
						}}
					/>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
			<DropdownMenuSub>
				<DropdownMenuSubTrigger>
					{t("list.pickRange")}
					{span && <MenuValue>{`${shortDate(fromIso(span.from))} – ${shortDate(fromIso(span.to))}`}</MenuValue>}
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent bare>
					<Calendar
						mode="range"
						language={language}
						// The calendar follows `selected` only when it has `onSelect`; the days pressed are handled in `onDayClick`.
						selected={picked}
						onSelect={() => {}}
						defaultMonth={picked?.from}
						onDayClick={(pressed) => {
							if (start === null) return setStart(pressed);
							const [from, to] = pressed < start ? [pressed, start] : [start, pressed];
							apply({ from: iso(from), to: iso(to) });
						}}
					/>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		</>
	);
}
