"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { createContext, useContext, useId, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { FormFieldDescription, FormFieldError, FormFieldLabel, FormField as UiField } from "../../ui/field.js";
import { IconButton } from "../../ui/icon-button.js";
import { Input } from "../../ui/input.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Switch } from "../../ui/switch.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip.js";
import { HELP, Labeled } from "../shared/labeled.js";
import { schemaMessages } from "./messages.js";
import { nameProblem } from "./schema-model.js";
const Context = createContext({
    disabled: true,
    vocabulary: { blocks: [], marks: [] },
    issues: [],
    collectionNames: [],
    codeCollections: [],
    file: {},
});
export const SchemaEditProvider = Context.Provider;
export const useSchemaEdit = () => useContext(Context);
/** The problems of the last check at `path` or below it. */
export function useIssuesUnder(path, exclude) {
    const { issues } = useSchemaEdit();
    return issues.filter((issue) => (issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`)) &&
        !(exclude && issue.path.startsWith(`${path}${exclude}`)));
}
export function IssueList({ issues }) {
    if (issues.length === 0)
        return null;
    return (_jsx("ul", { className: "flex flex-col gap-0.5 text-monti-destructive text-xs", "data-testid": "schema-issues", children: issues.map((issue) => (_jsxs("li", { children: [_jsx("code", { className: "rounded bg-monti-destructive/10 px-1", children: issue.path || "(root)" }), " ", issue.message] }, `${issue.path}:${issue.message}`))) }));
}
export function TextInput({ label, value, onChange, placeholder, description, hint, type = "text", className, optional, disabled: customDisabled, }) {
    const t = useTranslator(schemaMessages);
    const id = useId();
    const { disabled } = useSchemaEdit();
    const isDisabled = disabled || customDisabled;
    return (_jsx(Labeled, { label: optional ? (_jsxs(_Fragment, { children: [label, " ", _jsx("span", { className: "font-normal text-monti-muted-foreground", children: t("sheet.optional") })] })) : (label), description: description, hint: hint, htmlFor: id, className: className, children: _jsx(Input, { id: id, type: type, min: type === "number" ? 1 : undefined, value: value ?? "", placeholder: placeholder, disabled: isDisabled, onChange: (event) => onChange(event.target.value) }) }));
}
/** A text value that is `undefined` when empty (an optional property of the file). */
export const orUndefined = (value) => (value === "" ? undefined : value);
export const countOrUndefined = (value) => {
    const count = Number.parseInt(value, 10);
    return Number.isFinite(count) && count > 0 ? count : undefined;
};
export function FlagSwitch({ label, checked, onChange, description, hint, className, locked, }) {
    const id = useId();
    const { disabled: readOnly } = useSchemaEdit();
    const disabled = readOnly || locked === true;
    const desc = description ?? hint;
    return (_jsxs(UiField, { orientation: "horizontal", className: cn("w-full items-start justify-between gap-4", className), children: [_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx(FormFieldLabel, { htmlFor: id, className: "font-medium text-sm", children: label }), desc && _jsx(FormFieldDescription, { className: HELP, children: desc })] }), _jsx(Switch, { id: id, size: "sm", checked: checked, disabled: disabled, className: "mt-0.5 shrink-0", onCheckedChange: (next) => onChange(next === true) })] }));
}
/** A few exclusive choices side by side in one rounded strip (a segmented control). */
export function Segmented({ label, value, items, onChange, description, hint, }) {
    const { disabled } = useSchemaEdit();
    const id = useId();
    return (_jsxs(UiField, { className: "gap-2", children: [_jsx(FormFieldLabel, { id: id, className: "font-medium text-sm", children: label }), description && _jsx(FormFieldDescription, { className: HELP, children: description }), _jsx("div", { role: "radiogroup", "aria-labelledby": id, className: "flex w-fit max-w-full flex-wrap gap-0.5 rounded-md bg-monti-muted p-[3px] text-sm", children: items.map((item) => (_jsx("button", { type: "button", role: "radio", "aria-checked": item.value === value, disabled: disabled, onClick: () => onChange(item.value), className: cn("h-7 rounded-[3px] border border-transparent px-3 text-monti-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-monti-ring/50 disabled:opacity-50", item.value === value && "border-monti-border bg-monti-background font-medium text-monti-foreground"), children: item.label }, item.value))) }), hint && _jsx(FormFieldDescription, { className: HELP, children: hint })] }));
}
export function Pick({ label, value, items, onChange, description, hint, className, disabled: customDisabled, control = "narrow", size = "default", }) {
    const id = useId();
    const { disabled } = useSchemaEdit();
    const isDisabled = disabled || customDisabled;
    return (_jsx(Labeled, { label: label, description: description, hint: hint, htmlFor: id, className: className, control: control, children: _jsxs(Select, { value: value, items: items, disabled: isDisabled, onValueChange: (next) => typeof next === "string" && onChange(next), children: [_jsx(SelectTrigger, { id: id, size: size, className: "w-full", "aria-label": label, children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: items.map((item) => (_jsx(SelectItem, { value: item.value, children: item.description ? (_jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { children: item.label }), _jsx("span", { className: "whitespace-normal text-monti-muted-foreground text-xs", children: item.description })] })) : (item.label) }, item.value))) })] }) }));
}
/**
 * An input for a name (a field, an option, a collection): the change is taken when the writer leaves the input or presses Enter, and a name that cannot be used
 * is refused with the reason, so a half-typed name never renames anything.
 */
export function NameInput({ label, value, taken, onCommit, disabled: forcedDisabled, className, description, hint, }) {
    const t = useTranslator(schemaMessages);
    const id = useId();
    const { disabled } = useSchemaEdit();
    const [text, setText] = useState(value);
    const [shown, setShown] = useState(value);
    if (shown !== value) {
        setShown(value);
        setText(value);
    }
    const problem = text === value ? null : nameProblem(text, taken);
    const commit = () => {
        if (text === value)
            return;
        if (nameProblem(text, taken)) {
            setText(value);
            return;
        }
        onCommit(text);
    };
    return (_jsxs(Labeled, { label: label, htmlFor: id, className: className, description: description, hint: hint, children: [_jsx(Input, { id: id, value: text, disabled: disabled || forcedDisabled, "aria-invalid": problem ? true : undefined, onChange: (event) => setText(event.target.value), onBlur: commit, onKeyDown: (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        commit();
                    }
                } }), problem && _jsx(FormFieldError, { className: "text-xs", children: t(`name.${problem}`) })] }));
}
/** Up, down and remove buttons of one row of a list. */
export function RowActions({ index, count, onMove, onRemove, name, removeBlocked, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    return (_jsxs("div", { className: "flex shrink-0 items-center", children: [_jsx(IconButton, { label: t("row.up", { name }), size: "icon-xs", disabled: disabled || index === 0, onClick: () => onMove(-1), children: _jsx(ArrowUp, { "aria-hidden": true }) }), _jsx(IconButton, { label: t("row.down", { name }), size: "icon-xs", disabled: disabled || index === count - 1, onClick: () => onMove(1), children: _jsx(ArrowDown, { "aria-hidden": true }) }), removeBlocked ? (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx("span", { tabIndex: 0, "data-testid": "remove-blocked" }), children: _jsx(Button, { type: "button", variant: "ghost", size: "icon-xs", disabled: true, "aria-label": t("row.remove", { name }), "aria-description": removeBlocked, className: "pointer-events-none text-monti-destructive", children: _jsx(X, { "aria-hidden": true }) }) }), _jsx(TooltipContent, { side: "top", children: removeBlocked })] })) : (_jsx(IconButton, { label: t("row.remove", { name }), size: "icon-xs", destructive: true, disabled: disabled, onClick: onRemove, children: _jsx(X, { "aria-hidden": true }) }))] }));
}
export function AddButton({ children, onClick, disabled: off, }) {
    const { disabled } = useSchemaEdit();
    return (_jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: disabled || off, onClick: onClick, children: [_jsx(Plus, { "aria-hidden": true }), children] }));
}
