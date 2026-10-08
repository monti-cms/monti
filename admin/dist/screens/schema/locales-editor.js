"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { useState } from "react";
import { Button } from "../../ui/button.js";
import { Input } from "../../ui/input.js";
import { Labeled, orUndefined, Pick, RowActions, TextInput, useSchemaEdit } from "./controls.js";
import { schemaMessages } from "./messages.js";
import { localesOf, moveItem, setProp } from "./schema-model.js";
const CODE = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/;
/** The content locales (code, name, label), the default one, and the time zone. A saved locale's code is a stored value, so it is not editable; add a new locale instead. */
export function LocalesEditor({ file, savedCodes, update, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const locales = localesOf(file);
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const change = (next) => update((current) => ({ ...current, locales: next }));
    const edit = (index, patch) => change(locales.map((locale, at) => {
        if (at !== index)
            return locale;
        const merged = { ...locale, ...patch };
        for (const key of Object.keys(merged))
            if (merged[key] === undefined)
                delete merged[key];
        return merged;
    }));
    const defaultLocale = typeof file.defaultLocale === "string" ? file.defaultLocale : "";
    const taken = locales.map((locale) => locale.code);
    const addable = CODE.test(code) && !taken.includes(code) && name.trim() !== "";
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("locales.hint") }), _jsx("ul", { className: "flex flex-col gap-2", children: locales.map((locale, index) => (_jsxs("li", { className: "flex flex-wrap items-end gap-2 rounded-lg border p-2.5", "data-testid": `locale-${locale.code}`, children: [_jsx(Labeled, { label: t("locales.code"), className: "w-24 flex-none", children: _jsx(Input, { value: locale.code, disabled: true, "aria-label": t("locales.code") }) }), _jsx(TextInput, { label: t("locales.name"), value: locale.name, className: "min-w-32 flex-1", onChange: (value) => edit(index, { name: value }) }), _jsx(TextInput, { label: t("locales.label"), value: locale.label, className: "min-w-32 flex-1", onChange: (value) => edit(index, { label: orUndefined(value) }) }), _jsx(RowActions, { index: index, count: locales.length, name: locale.code, onMove: (delta) => change(moveItem(locales, index, delta)), onRemove: () => {
                                change(locales.filter((_, at) => at !== index));
                            } }), !savedCodes.includes(locale.code) && (_jsx("span", { className: "w-full text-cms-muted-foreground text-xs", children: t("locales.newHint") }))] }, locale.code))) }), !disabled && (_jsxs("div", { className: "flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-2", children: [_jsx(Labeled, { label: t("locales.newCode"), className: "w-28", children: _jsx(Input, { value: code, "aria-label": t("locales.newCode"), placeholder: "en", onChange: (event) => setCode(event.target.value) }) }), _jsx(Labeled, { label: t("locales.newName"), className: "min-w-32 flex-1", children: _jsx(Input, { value: name, "aria-label": t("locales.newName"), placeholder: "English", onChange: (event) => setName(event.target.value) }) }), _jsx(Button, { type: "button", variant: "outline", size: "sm", disabled: !addable, onClick: () => {
                            change([...locales, { code, name }]);
                            setCode("");
                            setName("");
                        }, children: t("locales.add") })] })), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Pick, { label: t("locales.default"), hint: t("locales.defaultHint"), value: defaultLocale, items: locales.map((locale) => ({
                            value: locale.code,
                            label: `${locale.label ?? locale.name} (${locale.code})`,
                        })), onChange: (value) => update((current) => ({ ...current, defaultLocale: value })) }), _jsx(TextInput, { label: t("locales.timeZone"), hint: t("locales.timeZoneHint"), placeholder: "Asia/Seoul", value: file.timeZone, onChange: (value) => update((current) => setProp(current, "timeZone", orUndefined(value), [
                            "$schema",
                            "schemaVersion",
                            "collections",
                            "migrations",
                            "locales",
                            "defaultLocale",
                        ])) })] })] }));
}
