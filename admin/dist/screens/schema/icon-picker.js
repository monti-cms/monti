"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { ChevronDown, FileText, Tag } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { cn } from "../../lib/utils/index.js";
import { Button } from "../../ui/button.js";
import { Input } from "../../ui/input.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { COLLECTION_ICON_NAMES, ICONS } from "../shared/collection-icon.js";
import { Labeled } from "../shared/labeled.js";
import { schemaCollectionMessages } from "./collection.messages.js";
import { useSchemaEdit } from "./controls.js";
/**
 * Picker for collection icons. Shows a button with the current icon and opens a popover with
 * a searchable grid of curated CMS icons.
 */
export function IconPicker({ label, value, kind, onChange, }) {
    const t = useTranslator(schemaCollectionMessages);
    const { disabled } = useSchemaEdit();
    const id = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const defaultIconName = kind === "item" ? "tag" : "file-text";
    const DefaultIcon = kind === "item" ? Tag : FileText;
    const CurrentIcon = value && ICONS[value] ? ICONS[value] : DefaultIcon;
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return COLLECTION_ICON_NAMES;
        return COLLECTION_ICON_NAMES.filter((name) => name.includes(q));
    }, [query]);
    return (_jsx(Labeled, { label: label, htmlFor: id, children: _jsxs(Popover, { open: open, onOpenChange: setOpen, children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { id: id, type: "button", variant: "outline", disabled: disabled, "aria-label": `${label}: ${value || t("collection.iconDefault")}`, className: "h-9 w-full max-w-sm justify-start gap-2.5 font-normal" }), children: [_jsx("span", { className: "flex size-5 items-center justify-center text-cms-muted-foreground", children: _jsx(CurrentIcon, { className: "size-4" }) }), _jsx("span", { className: "truncate", children: value || t("collection.iconDefault") }), _jsx(ChevronDown, { "aria-hidden": true, className: "ml-auto size-4 shrink-0 text-cms-muted-foreground" })] }), _jsx(PopoverContent, { align: "start", className: "w-72 p-3", children: _jsxs("div", { className: "flex flex-col gap-2.5", children: [_jsx(Input, { value: query, placeholder: t("collection.iconSearch"), onChange: (e) => setQuery(e.target.value), className: "h-8 text-xs", autoFocus: true }), value && (_jsxs(Button, { type: "button", variant: "ghost", size: "xs", className: "justify-start text-cms-muted-foreground text-xs hover:text-cms-foreground", onClick: () => {
                                    onChange(undefined);
                                    setOpen(false);
                                }, children: [t("collection.iconClear"), " (", defaultIconName, ")"] })), _jsx("div", { className: "grid max-h-56 grid-cols-6 gap-1 overflow-y-auto p-0.5", role: "listbox", children: filtered.map((name) => {
                                    const Icon = ICONS[name];
                                    if (!Icon)
                                        return null;
                                    const isSelected = value === name;
                                    return (_jsx("button", { type: "button", role: "option", "aria-selected": isSelected, title: name, "aria-label": name, onClick: () => {
                                            onChange(name);
                                            setOpen(false);
                                        }, className: cn("flex size-9 items-center justify-center rounded-md transition-colors hover:bg-cms-accent", isSelected && "bg-cms-primary/10 text-cms-primary ring-1 ring-cms-primary"), children: _jsx(Icon, { className: "size-4" }) }, name));
                                }) }), filtered.length === 0 && (_jsx("p", { className: "py-4 text-center text-cms-muted-foreground text-xs", children: t("collection.iconNone") }))] }) })] }) }));
}
