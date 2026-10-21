"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LOCALE_CODE, useTranslator } from "@monti-cms/core/site";
import { ChevronsUpDown, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { moveWithin } from "../../lib/utils/move-within.js";
import { Button } from "../../ui/button.js";
import { Panel } from "../../ui/card.js";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "../../ui/combobox.js";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/command.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { DialogFormFooter } from "../../ui/dialog-form-footer.js";
import { Input } from "../../ui/input.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { Labeled } from "../shared/labeled.js";
import { Section } from "../shared/section.js";
import { Pick, useSchemaEdit } from "./controls.js";
import { SortableList } from "./fields-tree-dnd.js";
import { RowButtons } from "./fields-tree-rows.js";
import { schemaLocalesMessages } from "./locales.messages.js";
import { schemaMessages } from "./messages.js";
import { localesOf, setProp } from "./schema-model.js";
/** The IANA time zones the runtime knows, with UTC (which `Intl.supportedValuesOf` leaves out) and the file's own value when it is none of them. */
const zonesWith = (current) => {
    let known = [];
    try {
        known = Intl.supportedValuesOf("timeZone");
    }
    catch {
        // an old runtime: the list is the current value and UTC
    }
    return [...new Set(["UTC", ...known, ...(current ? [current] : [])])].sort((a, b) => a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b));
};
/** `UTC+9` for a zone, as of now (it is what people compare zones by). */
function offsetOf(zone) {
    try {
        const part = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
            .formatToParts(new Date())
            .find((item) => item.type === "timeZoneName");
        return part ? part.value.replace("GMT", "UTC") : "";
    }
    catch {
        return "";
    }
}
/** A searchable list of time zones; clearing it removes `timeZone` from the file (UTC applies). */
function TimeZonePick({ value, onChange, }) {
    const t = useTranslator(schemaLocalesMessages);
    const { disabled } = useSchemaEdit();
    const id = useId();
    const zones = useMemo(() => zonesWith(value), [value]);
    return (_jsx(Labeled, { label: t("locales.timeZone"), htmlFor: id, children: _jsxs(Combobox, { items: zones, autoHighlight: true, disabled: disabled, value: value ?? null, onValueChange: (next) => onChange(next ?? undefined), children: [_jsx(ComboboxInput, { id: id, "aria-label": t("locales.timeZone"), placeholder: "Asia/Seoul", showClear: value !== undefined, disabled: disabled, className: "w-full" }), _jsxs(ComboboxContent, { children: [_jsx(ComboboxEmpty, { children: t("locales.timeZoneNone") }), _jsx(ComboboxList, { children: (zone) => (_jsxs(ComboboxItem, { value: zone, children: [_jsx("span", { className: "truncate", children: zone }), _jsx("span", { className: "ml-auto text-monti-muted-foreground text-xs", children: offsetOf(zone) })] }, zone)) })] })] }) }));
}
/** Common language codes offered while typing a code. Any other valid code can still be typed. */
const KNOWN_CODES = [
    "ar",
    "bn",
    "cs",
    "da",
    "de",
    "el",
    "en",
    "es",
    "fa",
    "fi",
    "fr",
    "he",
    "hi",
    "hu",
    "id",
    "it",
    "ja",
    "ko",
    "ms",
    "nl",
    "no",
    "pl",
    "pt",
    "pt-BR",
    "ro",
    "ru",
    "sv",
    "th",
    "tr",
    "uk",
    "vi",
    "zh",
    "zh-CN",
    "zh-TW",
];
/** The autonym of a language in its own language (for example the localized name for `ko`), or undefined when the runtime does not know the code. */
function nativeNameOf(code) {
    try {
        const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
        return name && name !== code ? name : undefined;
    }
    catch {
        return undefined;
    }
}
/** The dialog that adds a language or edits one. The code of a saved language is a stored value, so editing shows it but does not change it. */
function LocaleDialog({ locale, taken, onSave, onClose, }) {
    const t = useTranslator(schemaLocalesMessages);
    const tc = useTranslator(commonMessages);
    const codeId = useId();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [code, setCode] = useState(locale?.code ?? "");
    const [name, setName] = useState(locale?.name ?? "");
    const [label, setLabel] = useState(locale?.label ?? "");
    const availableCodes = useMemo(() => KNOWN_CODES.filter((known) => !taken.includes(known)), [taken]);
    const codeOk = locale !== undefined || (LOCALE_CODE.test(code) && !taken.includes(code));
    const ok = codeOk && name.trim() !== "";
    const handleCodeSelect = (next) => {
        setCode(next);
        if (!locale && name.trim() === "") {
            const native = nativeNameOf(next);
            if (native)
                setName(native);
        }
    };
    const trimmedSearch = search.trim();
    const isCustom = trimmedSearch.length > 0 &&
        !availableCodes.includes(trimmedSearch) &&
        LOCALE_CODE.test(trimmedSearch) &&
        !taken.includes(trimmedSearch);
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", "data-testid": "locale-dialog", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: locale ? t("locales.editTitle", { name: locale.name }) : t("locales.addTitle") }), !locale && _jsx(DialogDescription, { children: t("locales.contentNote") })] }), _jsxs("form", { className: "flex flex-col gap-6", onSubmit: (event) => {
                        event.preventDefault();
                        if (!ok)
                            return;
                        onSave({ code, name: name.trim(), ...(label.trim() ? { label: label.trim() } : {}) });
                    }, children: [_jsx(Labeled, { label: t("locales.code"), htmlFor: codeId, children: locale !== undefined ? (_jsx(Input, { id: codeId, value: code, disabled: true, "aria-label": t("locales.code") })) : (_jsxs("div", { className: "relative", children: [_jsx("input", { id: codeId, className: "sr-only", "aria-label": t("locales.code"), tabIndex: -1, value: code, onChange: (event) => handleCodeSelect(event.target.value) }), _jsxs(Popover, { open: open, onOpenChange: (nextOpen) => {
                                            setOpen(nextOpen);
                                            if (!nextOpen)
                                                setSearch("");
                                        }, children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", variant: "outline", role: "combobox", "aria-expanded": open, autoFocus: true, className: cn("w-full justify-between font-normal", !code && "text-monti-muted-foreground", code !== "" && !codeOk && "border-monti-destructive text-monti-destructive") }), children: [code ? (_jsxs("span", { className: "flex items-center gap-2 truncate", children: [_jsx("span", { className: "font-mono font-semibold text-xs", children: code }), nativeNameOf(code) && (_jsx("span", { className: "text-monti-muted-foreground text-xs", children: nativeNameOf(code) }))] })) : (_jsx("span", { children: t("locales.codePlaceholder") })), _jsx(ChevronsUpDown, { "aria-hidden": true, className: "ml-auto size-4 shrink-0 opacity-50" })] }), _jsx(PopoverContent, { align: "start", className: "w-(--anchor-width) min-w-72 p-0", children: _jsxs(Command, { children: [_jsx(CommandInput, { value: search, onValueChange: setSearch, placeholder: t("locales.codeSearch"), "aria-label": t("locales.codeSearch"), autoFocus: true }), _jsxs(CommandList, { className: "max-h-60", children: [_jsx(CommandEmpty, { children: t("locales.codeNone") }), _jsx(CommandGroup, { children: availableCodes.map((known) => {
                                                                        const native = nativeNameOf(known);
                                                                        return (_jsxs(CommandItem, { value: `${known} ${native ?? ""}`, "data-checked": code === known ? "true" : undefined, onSelect: () => {
                                                                                handleCodeSelect(known);
                                                                                setOpen(false);
                                                                            }, children: [_jsx("span", { className: "font-mono font-semibold text-xs", children: known }), native && _jsx("span", { className: "ml-1 text-monti-muted-foreground text-xs", children: native })] }, known));
                                                                    }) }), isCustom && (_jsx(CommandGroup, { children: _jsxs(CommandItem, { value: trimmedSearch, onSelect: () => {
                                                                            handleCodeSelect(trimmedSearch);
                                                                            setOpen(false);
                                                                        }, children: [_jsx(Plus, { className: "size-4 shrink-0 text-monti-muted-foreground" }), _jsx("span", { children: t("locales.codeCustom", { code: trimmedSearch }) })] }) }))] })] }) })] })] })) }), _jsx(Labeled, { label: t("locales.label"), children: _jsx(Input, { autoFocus: locale !== undefined, value: label, "aria-label": t("locales.label"), placeholder: name || "English", onChange: (event) => setLabel(event.target.value) }) }), _jsx(Labeled, { label: t("locales.name"), children: _jsx(Input, { value: name, "aria-label": t("locales.name"), placeholder: "English", onChange: (event) => setName(event.target.value) }) }), _jsx(DialogFormFooter, { onCancel: onClose, cancelLabel: tc("cancel"), submitLabel: locale ? tc("save") : t("locales.add"), disabled: !ok })] })] }) }));
}
/** One language of the list: a grip to drag it, and its buttons on hover (the same way a field row is reordered). */
function LocaleRow({ locale, isDefault, dragDisabled, buttons, }) {
    const t = useTranslator(schemaLocalesMessages);
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: locale.code,
        disabled: dragDisabled,
    });
    const displayName = locale.label ?? locale.name;
    const hasDistinctNative = Boolean(locale.label && locale.label !== locale.name);
    return (_jsxs("li", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, className: cn("group/row relative flex min-h-14 items-center gap-3.5 bg-monti-card py-2 pr-4 pl-9", isDragging && "z-10 opacity-80 shadow-md"), "data-testid": `locale-${locale.code}`, children: [_jsx("button", { type: "button", ref: setActivatorNodeRef, ...attributes, ...listeners, "aria-label": t("locales.drag", { name: displayName }), disabled: dragDisabled, className: "absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-monti-muted-foreground opacity-0 outline-none hover:text-monti-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-ring/50 disabled:hidden group-hover/row:opacity-100", children: _jsx(GripVertical, { "aria-hidden": true, className: "size-4" }) }), _jsx("span", { className: "flex h-6 min-w-9 items-center justify-center rounded-sm bg-monti-muted px-1.5 font-mono text-xs", children: locale.code }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-sm", children: displayName }), isDefault && (_jsx("span", { className: "rounded-sm bg-monti-primary/10 px-1.5 py-px text-monti-primary text-xs", children: t("locales.defaultBadge") }))] }), hasDistinctNative && (_jsx("div", { className: "truncate text-monti-muted-foreground text-xs", children: t("locales.nativeName", { name: locale.name }) }))] }), _jsx(RowButtons, { buttons: buttons })] }));
}
/** The content languages (code, name, admin name) as one list, the default one, and the time zone. A saved language's code is a stored value, so it is not editable; add a new language instead. */
export function LocalesEditor({ file, update }) {
    const t = useTranslator(schemaLocalesMessages);
    const ts = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const locales = localesOf(file);
    const [dialog, setDialog] = useState(null);
    const change = (next) => update((current) => ({ ...current, locales: next }));
    const defaultLocale = typeof file.defaultLocale === "string" ? file.defaultLocale : "";
    const taken = locales.map((locale) => locale.code);
    const editing = dialog?.code ? locales.find((locale) => locale.code === dialog.code) : undefined;
    const buttons = (locale, index) => {
        const isDefault = locale.code === defaultLocale;
        return [
            {
                label: t("locales.editNamed", { name: locale.label ?? locale.name }),
                icon: Pencil,
                disabled,
                onClick: () => setDialog({ code: locale.code }),
            },
            {
                label: ts("row.remove", { name: locale.code }),
                icon: Trash2,
                destructive: true,
                disabled: disabled || isDefault,
                title: isDefault ? t("locales.removeBlockedDefault") : undefined,
                onClick: () => change(locales.filter((_, at) => at !== index)),
            },
        ];
    };
    const onDrop = (from, to) => change(moveWithin(locales, taken.indexOf(from), taken.indexOf(to)));
    return (_jsxs("div", { className: "flex flex-col gap-12", children: [_jsx(Section, { wide: true, card: false, title: t("locales.contentTitle"), testId: "locales-content", children: _jsxs(Panel, { className: "overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 border-b px-4 py-3", children: [_jsx("span", { className: "text-monti-muted-foreground text-sm", children: t("locales.count", { count: locales.length }) }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: disabled, onClick: () => setDialog({ code: null }), children: [_jsx(Plus, { "aria-hidden": true }), t("locales.add")] })] }), _jsx("ul", { className: "divide-y", children: _jsx(SortableList, { items: taken, onDragEnd: onDrop, children: locales.map((locale, index) => (_jsx(LocaleRow, { locale: locale, isDefault: locale.code === defaultLocale, dragDisabled: disabled, buttons: buttons(locale, index) }, locale.code))) }) })] }) }), _jsx(Section, { wide: true, title: t("locales.defaultTitle"), testId: "locales-default", children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx(Pick, { label: t("locales.default"), value: defaultLocale, items: locales.map((locale) => ({
                                value: locale.code,
                                label: `${locale.label ?? locale.name} (${locale.code})`,
                            })), onChange: (value) => update((current) => ({ ...current, defaultLocale: value })) }), _jsx(TimeZonePick, { value: typeof file.timeZone === "string" ? file.timeZone : undefined, onChange: (value) => update((current) => setProp(current, "timeZone", value, ["collections", "migrations", "locales", "defaultLocale"])) })] }) }), dialog && (_jsx(LocaleDialog, { locale: editing, taken: taken, onClose: () => setDialog(null), onSave: (locale) => {
                    change(editing ? locales.map((item) => (item.code === editing.code ? locale : item)) : [...locales, locale]);
                    setDialog(null);
                } }, dialog.code ?? "new"))] }));
}
