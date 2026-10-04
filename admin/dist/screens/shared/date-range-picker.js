"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { CalendarRange } from "lucide-react";
import { Button } from "../../ui/button.js";
import { Calendar } from "../../ui/calendar.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { dateRangeMessages } from "./date-range.messages.js";
const t = createTranslator(dateRangeMessages);
/** `YYYY-MM-DD` ↔ calendar date. The admin filter takes dates in the configured time zone and sends them to the server as day boundaries. */
export const dayToDate = (value) => {
    if (!value)
        return undefined;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
};
export const dateToDay = (date) => date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
/** Date range calendar. Click the start date then the end date. Clicking one day selects just that day. */
export function DateRangeCalendar({ from, to, onChange, }) {
    return (_jsx(Calendar, { mode: "range", numberOfMonths: 1, selected: { from: dayToDate(from), to: dayToDate(to) }, onSelect: (range) => onChange(dateToDay(range?.from), dateToDay(range?.to ?? range?.from)), className: "rounded-md border" }));
}
/** Filter that opens the date range calendar when the button is pressed (shadcn Date Picker pattern). */
export function DateRangePicker({ label, from, to, onChange, }) {
    const summary = from || to ? `${from || t("start")} ~ ${to || t("end")}` : t("all");
    return (_jsxs(Popover, { children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", variant: "outline", size: "sm", "aria-label": `${label}: ${summary}` }), children: [_jsx(CalendarRange, { "aria-hidden": true }), label, ": ", summary] }), _jsxs(PopoverContent, { align: "start", className: "w-auto space-y-2 p-2", children: [_jsx(DateRangeCalendar, { from: from, to: to, onChange: onChange }), (from || to) && (_jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "w-full", onClick: () => onChange("", ""), children: t("clear") }))] })] }));
}
