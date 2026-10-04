"use client";

import { createTranslator } from "@monti-cms/core/client";
import { CalendarRange } from "lucide-react";
import { Button } from "../../ui/button";
import { Calendar } from "../../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { dateRangeMessages } from "./date-range.messages";

const t = createTranslator(dateRangeMessages);

/** `YYYY-MM-DD` ↔ calendar date. The admin filter takes dates in the configured time zone and sends them to the server as day boundaries. */
export const dayToDate = (value: string) => {
	if (!value) return undefined;
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y as number, (m as number) - 1, d);
};

export const dateToDay = (date: Date | undefined) =>
	date
		? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
		: "";

/** Date range calendar. Click the start date then the end date. Clicking one day selects just that day. */
export function DateRangeCalendar({
	from,
	to,
	onChange,
}: {
	from: string;
	to: string;
	onChange: (from: string, to: string) => void;
}) {
	return (
		<Calendar
			mode="range"
			numberOfMonths={1}
			selected={{ from: dayToDate(from), to: dayToDate(to) }}
			onSelect={(range) => onChange(dateToDay(range?.from), dateToDay(range?.to ?? range?.from))}
			className="rounded-md border"
		/>
	);
}

/** Filter that opens the date range calendar when the button is pressed (shadcn Date Picker pattern). */
export function DateRangePicker({
	label,
	from,
	to,
	onChange,
}: {
	label: string;
	from: string;
	to: string;
	onChange: (from: string, to: string) => void;
}) {
	const summary = from || to ? `${from || t("start")} ~ ${to || t("end")}` : t("all");
	return (
		<Popover>
			<PopoverTrigger render={<Button type="button" variant="outline" size="sm" aria-label={`${label}: ${summary}`} />}>
				<CalendarRange aria-hidden />
				{label}: {summary}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto space-y-2 p-2">
				<DateRangeCalendar from={from} to={to} onChange={onChange} />
				{(from || to) && (
					<Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange("", "")}>
						{t("clear")}
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
