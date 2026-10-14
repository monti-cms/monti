"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fillPattern, LOCALE_CODE, useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { commonMessages } from "../../lib/common.messages.js";
import { Button } from "../../ui/button.js";
import { Panel } from "../../ui/card.js";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "../../ui/combobox.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { DialogFormFooter } from "../../ui/dialog-form-footer.js";
import { Input } from "../../ui/input.js";
import { MoreActionsButton } from "../shared/action-menu.js";
import { Labeled } from "../shared/labeled.js";
import { Section } from "../shared/section.js";
import { Pick, useSchemaEdit } from "./controls.js";
import { schemaLocalesMessages } from "./locales.messages.js";
import { schemaMessages } from "./messages.js";
import { collectionsOf, localesOf, moveItem, sectionOf, setProp } from "./schema-model.js";
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
    return (_jsx(Labeled, { label: t("locales.timeZone"), hint: t("locales.timeZoneHelp"), htmlFor: id, children: _jsxs(Combobox, { items: zones, autoHighlight: true, disabled: disabled, value: value ?? null, onValueChange: (next) => onChange(next ?? undefined), children: [_jsx(ComboboxInput, { id: id, "aria-label": t("locales.timeZone"), placeholder: "Asia/Seoul", showClear: value !== undefined, disabled: disabled, className: "w-full" }), _jsxs(ComboboxContent, { children: [_jsx(ComboboxEmpty, { children: t("locales.timeZoneNone") }), _jsx(ComboboxList, { children: (zone) => (_jsxs(ComboboxItem, { value: zone, children: [_jsx("span", { className: "truncate", children: zone }), _jsx("span", { className: "ml-auto text-cms-muted-foreground text-xs", children: offsetOf(zone) })] }, zone)) })] })] }) }));
}
/** The dialog that adds a language or edits one. The code of a saved language is a stored value, so editing shows it but does not change it. */
function LocaleDialog({ locale, taken, onSave, onClose, }) {
    const t = useTranslator(schemaLocalesMessages);
    const tc = useTranslator(commonMessages);
    const [code, setCode] = useState(locale?.code ?? "");
    const [name, setName] = useState(locale?.name ?? "");
    const [label, setLabel] = useState(locale?.label ?? "");
    const codeOk = locale !== undefined || (LOCALE_CODE.test(code) && !taken.includes(code));
    const ok = codeOk && name.trim() !== "";
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", "data-testid": "locale-dialog", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: locale ? t("locales.editTitle", { name: locale.name }) : t("locales.addTitle") }), _jsx(DialogDescription, { children: t("locales.contentNote") })] }), _jsxs("form", { className: "flex flex-col gap-6", onSubmit: (event) => {
                        event.preventDefault();
                        if (!ok)
                            return;
                        onSave({ code, name: name.trim(), ...(label.trim() ? { label: label.trim() } : {}) });
                    }, children: [_jsx(Labeled, { label: t("locales.code"), hint: locale ? undefined : t("locales.codeHint"), children: _jsx(Input, { autoFocus: !locale, value: code, disabled: locale !== undefined, "aria-label": t("locales.code"), placeholder: "en", "aria-invalid": code !== "" && !codeOk ? true : undefined, onChange: (event) => setCode(event.target.value) }) }), _jsx(Labeled, { label: t("locales.name"), children: _jsx(Input, { autoFocus: locale !== undefined, value: name, "aria-label": t("locales.name"), placeholder: "English", onChange: (event) => setName(event.target.value) }) }), _jsx(Labeled, { label: t("locales.label"), hint: t("locales.labelHint"), children: _jsx(Input, { value: label, "aria-label": t("locales.label"), onChange: (event) => setLabel(event.target.value) }) }), _jsx(DialogFormFooter, { onCancel: onClose, cancelLabel: tc("cancel"), submitLabel: locale ? tc("save") : t("locales.add"), disabled: !ok })] })] }) }));
}
/** A public address of the first collection that has one, with `:slug` filled in: the example the language settings show. */
function examplePath(file) {
    for (const collection of Object.values(collectionsOf(file))) {
        if (typeof collection.path === "string" && collection.path.startsWith("/"))
            return fillPattern(collection.path, "hello");
    }
    return "/posts/hello";
}
const PREFIX_MODES = ["except-default", "always", "never"];
/** The content languages (code, name, admin name) as one list, the default one, and the time zone. A saved language's code is a stored value, so it is not editable; add a new language instead. */
export function LocalesEditor({ file, update, }) {
    const t = useTranslator(schemaLocalesMessages);
    const ts = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const locales = localesOf(file);
    const [dialog, setDialog] = useState(null);
    const change = (next) => update((current) => ({ ...current, locales: next }));
    const defaultLocale = typeof file.defaultLocale === "string" ? file.defaultLocale : "";
    const taken = locales.map((locale) => locale.code);
    const editing = dialog?.code ? locales.find((locale) => locale.code === dialog.code) : undefined;
    const mode = PREFIX_MODES.find((value) => value === sectionOf(file, "site").localePrefix) ?? "except-default";
    const other = locales.find((locale) => locale.code !== defaultLocale)?.code ?? "en";
    const menu = (locale, index) => [
        {
            kind: "item",
            label: t("locales.edit"),
            icon: Pencil,
            disabled,
            onSelect: () => setDialog({ code: locale.code }),
        },
        {
            kind: "item",
            label: ts("row.up", { name: locale.code }),
            icon: ArrowUp,
            disabled: disabled || index === 0,
            onSelect: () => change(moveItem(locales, index, -1)),
        },
        {
            kind: "item",
            label: ts("row.down", { name: locale.code }),
            icon: ArrowDown,
            disabled: disabled || index === locales.length - 1,
            onSelect: () => change(moveItem(locales, index, 1)),
        },
        { kind: "separator" },
        {
            kind: "item",
            label: ts("row.remove", { name: locale.code }),
            icon: Trash2,
            destructive: true,
            disabled,
            onSelect: () => change(locales.filter((_, at) => at !== index)),
        },
    ];
    return (_jsxs("div", { className: "flex flex-col gap-12", children: [_jsx(Section, { wide: true, card: false, title: t("locales.contentTitle"), description: t("locales.contentDescription"), note: t("locales.contentNote"), testId: "locales-content", children: _jsxs(Panel, { className: "overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 border-b px-4 py-3", children: [_jsx("span", { className: "text-cms-muted-foreground text-sm", children: t("locales.count", { count: locales.length }) }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: disabled, onClick: () => setDialog({ code: null }), children: [_jsx(Plus, { "aria-hidden": true }), t("locales.add")] })] }), _jsx("ul", { className: "divide-y", children: locales.map((locale, index) => (_jsxs("li", { className: "flex min-h-14 items-center gap-3.5 px-4 py-2", "data-testid": `locale-${locale.code}`, children: [_jsx("span", { className: "flex h-6 min-w-9 items-center justify-center rounded-sm bg-cms-muted px-1.5 font-mono text-xs", children: locale.code }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-sm", children: locale.name }), locale.code === defaultLocale && (_jsx("span", { className: "rounded-sm bg-cms-primary/10 px-1.5 py-px text-cms-primary text-xs", children: t("locales.defaultBadge") }))] }), _jsx("div", { className: "truncate text-cms-muted-foreground text-xs", children: t("locales.adminName", { label: locale.label ?? locale.name }) })] }), _jsx(MoreActionsButton, { actions: menu(locale, index), label: t("locales.menu", { name: locale.name }), className: "size-7 shrink-0 text-cms-muted-foreground" })] }, locale.code))) })] }) }), _jsx(Section, { wide: true, title: t("locales.defaultTitle"), description: t("locales.defaultDescription"), testId: "locales-default", children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx(Pick, { label: t("locales.default"), hint: t(`locales.addresses.${mode}`, { default: defaultLocale, other, path: examplePath(file) }), value: defaultLocale, items: locales.map((locale) => ({
                                value: locale.code,
                                label: `${locale.label ?? locale.name} (${locale.code})`,
                            })), onChange: (value) => update((current) => ({ ...current, defaultLocale: value })) }), _jsx(TimeZonePick, { value: typeof file.timeZone === "string" ? file.timeZone : undefined, onChange: (value) => update((current) => setProp(current, "timeZone", value, [
                                "schemaVersion",
                                "collections",
                                "migrations",
                                "locales",
                                "defaultLocale",
                            ])) })] }) }), dialog && (_jsx(LocaleDialog, { locale: editing, taken: taken, onClose: () => setDialog(null), onSave: (locale) => {
                    change(editing ? locales.map((item) => (item.code === editing.code ? locale : item)) : [...locales, locale]);
                    setDialog(null);
                } }, dialog.code ?? "new"))] }));
}
