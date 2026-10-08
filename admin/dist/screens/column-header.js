"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils/cn.js";
import { Button } from "../ui/button.js";
import { Checkbox } from "../ui/checkbox.js";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Separator } from "../ui/separator.js";
import { columnConfig, isColumnFiltered } from "./list-columns.js";
import { LIST_STATUSES } from "./list-state.js";
import { screensMessages } from "./messages.js";
import { DateRangeCalendar } from "./shared/date-range-picker.js";
import { statusLabels } from "./shared/entry-status.js";
function TextFilter({ value, placeholder, label, onApply, }) {
    const t = useTranslator(screensMessages);
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    return (_jsxs("form", { className: "flex gap-2", onSubmit: (event) => {
            event.preventDefault();
            onApply(draft);
        }, children: [_jsx(Input, { "aria-label": t("filter.label", { label }), value: draft, placeholder: placeholder, onChange: (event) => setDraft(event.target.value), className: "h-8" }), _jsx(Button, { type: "submit", size: "sm", children: t("filter.apply") })] }));
}
function CheckRow({ label, checked, onChange, }) {
    return (_jsxs(Label, { className: "flex items-center gap-2 rounded-sm px-2 py-1.5 font-normal hover:bg-cms-accent", children: [_jsx(Checkbox, { checked: checked, onCheckedChange: (next) => onChange(next === true) }), label] }));
}
function StatusFilter({ state, onChange }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const toggle = (status, on) => onChange({ statuses: on ? [...state.statuses, status] : state.statuses.filter((item) => item !== status) });
    return (_jsxs("fieldset", { className: "space-y-0.5", children: [_jsx("legend", { className: "sr-only", children: t("column.status") }), LIST_STATUSES.map((status) => (_jsx(CheckRow, { label: statusLabels(site)[status], checked: state.statuses.includes(status), onChange: (on) => toggle(status, on) }, status))), _jsx(Separator, { className: "my-1" }), _jsx(CheckRow, { label: t("filter.editing"), checked: state.hasChanges, onChange: (on) => onChange({ hasChanges: on }) })] }));
}
/** Locale checklist. Choosing several shows items matching any of them. */
function LocaleFilter({ state, onChange }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    return (_jsxs("fieldset", { className: "space-y-0.5", children: [_jsx("legend", { className: "sr-only", children: t("column.locale") }), site.LOCALES.map((locale) => (_jsx(CheckRow, { label: site.localeLabel(locale), checked: state.locales.includes(locale), onChange: (on) => onChange({ locales: on ? [...state.locales, locale] : state.locales.filter((item) => item !== locale) }) }, locale)))] }));
}
function TaxonomyFilter({ label, options, selected, onChange, }) {
    const t = useTranslator(screensMessages);
    const toggle = (id) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs(Command, { className: "bg-transparent p-0", children: [_jsx(CommandInput, { placeholder: t("filter.search", { label }), "aria-label": t("filter.search", { label }) }), _jsxs(CommandList, { className: "mt-1 max-h-56", children: [_jsx(CommandEmpty, { children: t("filter.empty", { label }) }), _jsx(CommandGroup, { className: "space-y-0.5 p-0", children: options.map((option) => (_jsxs(CommandItem, { value: `${option.title} ${option.id}`, onSelect: () => toggle(option.id), children: [_jsx(Checkbox, { checked: selected.includes(option.id), tabIndex: -1, "aria-hidden": true, className: "pointer-events-none" }), option.title] }, option.id))) })] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => onChange(options.map((option) => option.id)), children: t("filter.selectAll") }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => onChange([]), children: t("filter.clearAll") })] })] }));
}
function DateFilter({ label, from, to, onChange, }) {
    const t = useTranslator(screensMessages);
    return (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "px-1 text-cms-muted-foreground text-xs", children: label }), _jsx(DateRangeCalendar, { from: from, to: to, onChange: onChange }), _jsx("p", { className: "px-1 text-xs", "aria-live": "polite", children: from || to ? `${from || t("filter.rangeStart")} ~ ${to || t("filter.rangeEnd")}` : t("filter.noRange") })] }));
}
/** `relations` with one taxonomy filter changed. An empty list is removed. */
export function setRelation(state, field, ids) {
    const { [field]: _removed, ...rest } = state.relations;
    return { relations: ids.length > 0 ? { ...rest, [field]: ids } : rest };
}
const clearRelation = (state, field) => setRelation(state, field, []);
/** Change that clears this filter. Used by the chip's `✕` and the popup's `필터 해제`. */
export function clearPatchFor(filter, state) {
    switch (filter.kind) {
        case "text":
            return { [filter.key]: "" };
        case "status":
            return { statuses: [], hasChanges: false };
        case "relation":
            return clearRelation(state, filter.field);
        case "locale":
            return { locales: [] };
        case "date":
            return { [filter.from]: "", [filter.to]: "" };
        case "none":
            return {};
    }
}
/**
 * Sort/filter popup opened from the column header, like Excel. A header with a filter changes its icon shape
 * so state is not conveyed by color alone. Sortable columns put `aria-sort` on the header cell (done by the caller).
 */
export function ColumnHeader({ column, filter, state, options, onChange, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const config = columnConfig(site, state.collection, column);
    const sortField = config.sortField;
    const filtered = isColumnFiltered(state, filter);
    const sorted = sortField && state.sortField === sortField ? state.sortDirection : null;
    if (!sortField && filter.kind === "none")
        return _jsx("span", { children: config.label });
    const sortButton = (direction) => (_jsxs(Button, { type: "button", variant: sorted === direction ? "secondary" : "ghost", size: "sm", "aria-pressed": sorted === direction, className: "justify-start", onClick: () => sortField && onChange({ sortField, sortDirection: direction }), children: [direction === "asc" ? _jsx(ArrowUpNarrowWide, {}) : _jsx(ArrowDownWideNarrow, {}), direction === "asc" ? t("filter.sortAsc") : t("filter.sortDesc")] }));
    return (_jsxs(Popover, { children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: cn("-ml-2 h-7 gap-1 px-2 font-normal text-cms-muted-foreground text-xs", filtered && "text-cms-primary"), "aria-label": `${config.label}${sorted ? t("filter.sortedSuffix", { direction: sorted === "asc" ? t("filter.sortAsc") : t("filter.sortDesc") }) : ""}${filtered ? t("filter.filteredSuffix") : ""}` }), children: [config.label, sorted === "asc" && _jsx(ArrowUpNarrowWide, { "aria-hidden": true, className: "size-3.5" }), sorted === "desc" && _jsx(ArrowDownWideNarrow, { "aria-hidden": true, className: "size-3.5" }), filtered ? (_jsx(ListFilter, { "aria-hidden": true, className: "size-3.5 fill-current", "data-filtered": "" })) : (_jsx(ChevronDown, { "aria-hidden": true, className: "size-3.5 opacity-60" }))] }), _jsxs(PopoverContent, { align: "start", className: "w-72 space-y-3 p-3", children: [sortField && (_jsxs("fieldset", { className: "flex flex-col gap-1", children: [_jsx("legend", { className: "sr-only", children: t("filter.sortLegend", { label: config.label }) }), sortButton("asc"), sortButton("desc")] })), sortField && filter.kind !== "none" && _jsx(Separator, {}), filter.kind === "text" && (_jsx(TextFilter, { value: state[filter.key], placeholder: filter.placeholder, label: config.label, onApply: (value) => onChange({ [filter.key]: value }) })), filter.kind === "status" && _jsx(StatusFilter, { state: state, onChange: onChange }), filter.kind === "locale" && _jsx(LocaleFilter, { state: state, onChange: onChange }), filter.kind === "relation" && (_jsx(TaxonomyFilter, { label: config.label, options: options[filter.field] ?? [], selected: state.relations[filter.field] ?? [], onChange: (ids) => onChange(setRelation(state, filter.field, ids)) })), filter.kind === "date" && (_jsx(DateFilter, { label: config.label, from: state[filter.from], to: state[filter.to], onChange: (from, to) => onChange({ [filter.from]: from, [filter.to]: to }) })), filtered && (_jsx(Button, { type: "button", variant: "outline", size: "sm", className: "w-full", onClick: () => onChange(clearPatchFor(filter, state)), children: t("filter.clear") }))] })] }));
}
