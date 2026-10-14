import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// "Column settings" popover of the entries table: show/hide and reorder columns.
import { useSite, useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import { Button } from "../ui/button.js";
import { Checkbox } from "../ui/checkbox.js";
import { IconButton } from "../ui/icon-button.js";
import { Label } from "../ui/label.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { columnLabel } from "./list-columns.js";
import { screensMessages } from "./messages.js";
export function ColumnSettingsPopover({ collection, order, visibility, onToggle, onMove, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    return (_jsxs(Popover, { children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "xs", className: "text-cms-muted-foreground" }), children: [_jsx(Columns3, { "aria-hidden": true }), t("list.columnSettings")] }), _jsx(PopoverContent, { align: "end", className: "w-64 p-3", children: _jsx("ul", { className: "space-y-1", children: order.map((column, index) => (_jsxs("li", { className: "flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-cms-accent", children: [_jsxs(Label, { className: "font-normal", children: [_jsx(Checkbox, { checked: visibility[column] ?? false, disabled: column === "title", onCheckedChange: (checked) => onToggle(column, checked === true) }), columnLabel(site, collection, column)] }), _jsxs("span", { className: "flex gap-1", children: [_jsx(IconButton, { size: "icon-xs", variant: "outline", label: t("list.columnUp", { label: columnLabel(site, collection, column) }), disabled: index === 0, onClick: () => onMove(column, -1), children: _jsx(ArrowUp, { "aria-hidden": true }) }), _jsx(IconButton, { size: "icon-xs", variant: "outline", label: t("list.columnDown", { label: columnLabel(site, collection, column) }), disabled: index === order.length - 1, onClick: () => onMove(column, 1), children: _jsx(ArrowDown, { "aria-hidden": true }) })] })] }, column))) }) })] }));
}
