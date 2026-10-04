"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator, isDocumentCollection, localeLabel } from "@monti-cms/core/client";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button.js";
import { IconButton } from "../ui/icon-button.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group.js";
import { Label } from "../ui/label.js";
import { Switch } from "../ui/switch.js";
import { clearPatchFor } from "./column-header.js";
import { columnLabel, columnsFor, filterFor, isColumnFiltered } from "./list-columns.js";
import { clearFilters } from "./list-state.js";
import { screensMessages } from "./messages.js";
import { STATUS_LABELS } from "./shared/entry-status.js";
const t = createTranslator(screensMessages);
const nameOf = (options, id) => options.find((option) => option.id === id)?.title ?? t("toolbar.unknown");
function describe(filter, state, options) {
    switch (filter.kind) {
        case "text":
            return `"${state[filter.key].trim()}"`;
        case "status":
            return [
                ...state.statuses.map((status) => STATUS_LABELS[status]),
                ...(state.hasChanges ? [t("filter.editing")] : []),
            ].join(", ");
        case "relation":
            return (state.relations[filter.field] ?? []).map((id) => nameOf(options[filter.field] ?? [], id)).join(", ");
        case "locale":
            return state.locales.map((locale) => localeLabel(locale)).join(", ");
        case "date":
            return `${state[filter.from] || t("filter.rangeStart")} ~ ${state[filter.to] || t("filter.rangeEnd")}`;
        case "none":
            return "";
    }
}
/**
 * Applied filter chips. Even when a column is hidden, filters on it keep showing as chips
 * to prevent "why can't I see my posts?".
 */
export function filterChips(state, options) {
    const chips = [];
    if (state.search.trim()) {
        chips.push({
            key: "search",
            label: `${state.includeBody ? t("toolbar.chipBodySearch") : t("toolbar.chipSearch")}: "${state.search.trim()}"`,
            clear: { search: "", includeBody: false },
        });
    }
    for (const column of columnsFor(state.collection).available) {
        const filter = filterFor(state.collection, column);
        if (!isColumnFiltered(state, filter))
            continue;
        chips.push({
            key: column,
            label: `${columnLabel(state.collection, column)}: ${describe(filter, state, options)}`,
            clear: clearPatchFor(filter, state),
        });
    }
    return chips;
}
/** Search box in the header. Sends a server search when typing pauses. Posts and memos can turn on body search. */
export function ListSearch({ state, onChange, allowBody = true, }) {
    const [search, setSearch] = useState(state.search);
    useEffect(() => setSearch(state.search), [state.search]);
    useEffect(() => {
        if (search === state.search)
            return;
        const timer = setTimeout(() => onChange({ search }), 300);
        return () => clearTimeout(timer);
    }, [search, state.search, onChange]);
    const isContent = isDocumentCollection(state.collection);
    return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(InputGroup, { className: "h-8 w-64", children: [_jsx(InputGroupAddon, { children: _jsx(Search, { "aria-hidden": true }) }), _jsx(InputGroupInput, { type: "search", "aria-label": t("toolbar.searchLabel"), value: search, onChange: (event) => setSearch(event.target.value), placeholder: state.includeBody ? t("toolbar.searchBodyPlaceholder") : t("toolbar.searchPlaceholder") })] }), isContent && allowBody && (_jsxs(Label, { className: "font-normal text-cms-muted-foreground text-xs", children: [_jsx(Switch, { size: "sm", checked: state.includeBody, onCheckedChange: (checked) => onChange({ includeBody: checked === true }) }), t("toolbar.includeBody")] }))] }));
}
/** Row of applied filter chips. Not drawn when there are no filters. */
export function FilterChipBar({ state, options, onChange, }) {
    const chips = filterChips(state, options);
    if (chips.length === 0)
        return null;
    return (_jsxs("ul", { "aria-label": t("toolbar.chips"), className: "flex min-h-11 flex-wrap items-center gap-1.5 border-b px-5 py-2", children: [chips.map((chip) => (_jsx("li", { children: _jsxs("span", { className: "inline-flex h-6 items-center gap-1 rounded-md bg-cms-primary/10 pr-0.5 pl-2 font-medium text-cms-primary text-xs", children: [_jsx("span", { className: "max-w-72 truncate", children: chip.label }), _jsx(IconButton, { size: "icon-xs", className: "size-5 text-cms-primary hover:bg-cms-primary/15 hover:text-cms-primary", label: t("filter.clear"), onClick: () => onChange(chip.clear), children: _jsx(X, { "aria-hidden": true }) })] }) }, chip.key))), _jsx("li", { children: _jsx(Button, { type: "button", variant: "ghost", size: "xs", className: "text-cms-muted-foreground", onClick: () => {
                        const { collection: _c, folder: _f, includeDescendants: _d, pageSize: _p, ...cleared } = clearFilters(state);
                        onChange(cleared);
                    }, children: t("filter.clearAll") }) })] }));
}
