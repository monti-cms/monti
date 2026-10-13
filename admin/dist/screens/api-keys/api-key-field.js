"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { useId } from "react";
import { cn } from "../../lib/utils/cn.js";
import { Input } from "../../ui/input.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { useApiKeys } from "./api-keys-api.js";
import { apiKeysMessages } from "./messages.js";
/** The value that goes to the server. A new key with nothing typed is no key yet. */
export const choiceReady = (choice) => choice.use === "saved" ? choice.keyId !== "" : choice.use === "new" ? choice.value.trim() !== "" : true;
/** The name the store will give a key typed into a form: `baseName`, or `baseName 2`, ... when taken. Mirrors the server. */
function freeName(base, taken) {
    const used = new Set(taken.map((key) => key.name.toLowerCase()));
    if (!used.has(base.toLowerCase()))
        return base;
    for (let n = 2;; n++)
        if (!used.has(`${base} ${n}`.toLowerCase()))
            return `${base} ${n}`;
}
/**
 * The API key field of a form: "use a saved key" (a list of the store's keys) or "enter a new key" (saved into the store). The key a place uses now is
 * `current`; `baseName` is the name a new key gets (the service or the place). No value ever comes back from the server: a saved key shows its name and last four characters.
 */
export function ApiKeyField({ value, onChange, baseName, label, disabled, className, }) {
    const t = useTranslator(apiKeysMessages);
    const query = useApiKeys();
    const groupId = useId();
    const keys = query.data?.items ?? [];
    const canSave = query.data?.secretsAvailable !== false;
    const saved = value.use === "saved";
    const chosen = saved ? keys.find((key) => key.id === value.keyId) : undefined;
    const mask = (key) => (key.tail ? `••••${key.tail}` : "••••");
    return (_jsxs("fieldset", { className: cn("flex flex-col gap-1", className), disabled: disabled, "data-testid": "api-key-field", children: [_jsx("legend", { className: "mb-1.5 font-medium text-sm", id: groupId, children: label ?? t("field.keyLabel") }), _jsxs("div", { role: "radiogroup", "aria-labelledby": groupId, className: "flex max-w-xl flex-col gap-1", children: [_jsxs("label", { className: cn("flex items-start gap-2.5 rounded-md px-3 py-2.5", keys.length === 0 ? "opacity-60" : "cursor-pointer", saved && "bg-cms-accent/50 ring-1 ring-cms-border"), children: [_jsx("input", { type: "radio", name: `${groupId}-use`, className: "mt-1", checked: saved, disabled: keys.length === 0, onChange: () => onChange({ use: "saved", keyId: chosen?.id ?? keys[0]?.id ?? "" }) }), _jsxs("span", { className: "flex min-w-0 flex-1 flex-col gap-1.5", children: [_jsx("span", { className: cn("text-sm", saved && "font-medium"), children: t("field.useSaved") }), keys.length === 0 ? (_jsx("span", { className: "text-cms-muted-foreground text-xs", children: query.error ? t("field.loadFailed") : t("field.useSavedNone") })) : saved ? (_jsxs(_Fragment, { children: [_jsxs(Select, { value: value.keyId, onValueChange: (keyId) => typeof keyId === "string" && onChange({ use: "saved", keyId }), items: keys.map((key) => ({ value: key.id, label: key.name })), children: [_jsx(SelectTrigger, { "aria-label": t("field.savedPick"), className: "h-9 w-full max-w-sm", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: keys.map((key) => (_jsxs(SelectItem, { value: key.id, children: [_jsx("span", { children: key.name }), _jsx("span", { className: "ml-2 font-mono text-cms-muted-foreground text-xs", children: key.readable ? mask(key) : t("field.unreadable") })] }, key.id))) })] }), chosen && chosen.uses.length > 0 && (_jsx("span", { className: "text-cms-muted-foreground text-xs", children: t("field.savedUsedBy", { uses: chosen.uses.map((use) => use.label).join(", ") }) }))] })) : null] })] }), _jsxs("label", { className: cn("flex items-start gap-2.5 rounded-md px-3 py-2.5", canSave ? "cursor-pointer" : "opacity-60", value.use === "new" && "bg-cms-accent/50 ring-1 ring-cms-border"), children: [_jsx("input", { type: "radio", name: `${groupId}-use`, className: "mt-1", checked: value.use === "new", disabled: !canSave, onChange: () => onChange({ use: "new", value: "" }) }), _jsxs("span", { className: "flex min-w-0 flex-1 flex-col gap-1.5", children: [_jsx("span", { className: cn("text-sm", value.use === "new" && "font-medium"), children: t("field.useNew") }), value.use === "new" && (_jsxs(_Fragment, { children: [_jsx(Input, { type: "password", autoComplete: "off", "aria-label": t("field.newInput"), className: "h-9 max-w-sm font-mono text-sm", value: value.value, onChange: (event) => onChange({ use: "new", value: event.target.value }) }), _jsx("span", { className: "text-cms-muted-foreground text-xs", children: t("field.newHelp", { name: freeName(baseName, keys) }) })] })), !canSave && _jsx("span", { className: "text-cms-muted-foreground text-xs", children: t("field.secretMissing") })] })] })] })] }));
}
