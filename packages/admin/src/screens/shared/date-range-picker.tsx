"use client";

import { createTranslator } from "@monti-cms/core/client";
import { CalendarRange } from "lucide-react";
import { Button } from "../../ui/button";
import { Calendar } from "../../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { dateRangeMessages } from "./date-range.messages";

const t = createTranslator(dateRangeMessages);

/** `YYYY-MM-DD` ↔ 달력의 날짜. 관리자 필터는 설정 시간대의 날짜를 받아 서버에 하루 경계로 보낸다(§5.5). */
export const dayToDate = (value: string) => {
	if (!value) return undefined;
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y as number, (m as number) - 1, d);
};

export const dateToDay = (date: Date | undefined) =>
	date
		? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
		: "";

/** 날짜 범위 달력. 시작일과 끝날을 차례로 누른다. 하루만 누르면 그날 하루다. */
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

/** 버튼을 누르면 날짜 범위 달력을 여는 필터(shadcn Date Picker 패턴). */
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
