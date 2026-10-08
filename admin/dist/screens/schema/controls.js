"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { createContext, useContext, useId, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { FieldDescription, FieldError, FieldLabel, Field as UiField } from "../../ui/field.js";
import { IconButton } from "../../ui/icon-button.js";
import { Input } from "../../ui/input.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Switch } from "../../ui/switch.js";
import { schemaMessages } from "./messages.js";
import { moveItem, nameProblem } from "./schema-model.js";
const Context = createContext({
    disabled: true,
    vocabulary: { blocks: [], marks: [] },
    issues: [],
    collectionNames: [],
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
    return (_jsx("ul", { className: "flex flex-col gap-0.5 text-cms-destructive text-xs", "data-testid": "schema-issues", children: issues.map((issue) => (_jsxs("li", { children: [_jsx("code", { className: "rounded bg-cms-destructive/10 px-1", children: issue.path || "(root)" }), " ", issue.message] }, `${issue.path}:${issue.message}`))) }));
}
export function Labeled({ label, hint, children, htmlFor, className, }) {
    return (_jsxs(UiField, { className: cn("gap-1.5", className), children: [_jsx(FieldLabel, { htmlFor: htmlFor, className: "font-medium text-xs", children: label }), children, hint && _jsx(FieldDescription, { className: "text-xs", children: hint })] }));
}
export function TextInput({ label, value, onChange, placeholder, hint, type = "text", className, }) {
    const id = useId();
    const { disabled } = useSchemaEdit();
    return (_jsx(Labeled, { label: label, hint: hint, htmlFor: id, className: className, children: _jsx(Input, { id: id, type: type, min: type === "number" ? 1 : undefined, value: value ?? "", placeholder: placeholder, disabled: disabled, onChange: (event) => onChange(event.target.value) }) }));
}
/** A text value that is `undefined` when empty (an optional property of the file). */
export const orUndefined = (value) => (value === "" ? undefined : value);
export const countOrUndefined = (value) => {
    const count = Number.parseInt(value, 10);
    return Number.isFinite(count) && count > 0 ? count : undefined;
};
export function FlagSwitch({ label, checked, onChange, hint, }) {
    const id = useId();
    const { disabled } = useSchemaEdit();
    return (_jsxs(UiField, { orientation: "horizontal", className: "items-start gap-2", children: [_jsx(Switch, { id: id, size: "sm", checked: checked, disabled: disabled, onCheckedChange: (next) => onChange(next === true) }), _jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx(FieldLabel, { htmlFor: id, className: "font-normal text-sm", children: label }), hint && _jsx(FieldDescription, { className: "text-xs", children: hint })] })] }));
}
export function Pick({ label, value, items, onChange, hint, className, }) {
    const id = useId();
    const { disabled } = useSchemaEdit();
    return (_jsx(Labeled, { label: label, hint: hint, htmlFor: id, className: className, children: _jsxs(Select, { value: value, items: items, disabled: disabled, onValueChange: (next) => typeof next === "string" && onChange(next), children: [_jsx(SelectTrigger, { id: id, size: "sm", className: "w-full", "aria-label": label, children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: items.map((item) => (_jsx(SelectItem, { value: item.value, children: item.label }, item.value))) })] }) }));
}
/**
 * An input for a name (a field, an option, a collection): the change is taken when the writer leaves the input or presses Enter, and a name that cannot be used
 * is refused with the reason, so a half-typed name never renames anything.
 */
export function NameInput({ label, value, taken, onCommit, disabled: forcedDisabled, className, hint, }) {
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
    return (_jsxs(Labeled, { label: label, htmlFor: id, className: className, hint: hint, children: [_jsx(Input, { id: id, value: text, disabled: disabled || forcedDisabled, "aria-invalid": problem ? true : undefined, onChange: (event) => setText(event.target.value), onBlur: commit, onKeyDown: (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        commit();
                    }
                } }), problem && _jsx(FieldError, { className: "text-xs", children: t(`name.${problem}`) })] }));
}
/** Up, down and remove buttons of one row of a list. */
export function RowActions({ index, count, onMove, onRemove, name, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    return (_jsxs("div", { className: "flex shrink-0 items-center", children: [_jsx(IconButton, { label: t("row.up", { name }), size: "icon-xs", disabled: disabled || index === 0, onClick: () => onMove(-1), children: _jsx(ArrowUp, { "aria-hidden": true }) }), _jsx(IconButton, { label: t("row.down", { name }), size: "icon-xs", disabled: disabled || index === count - 1, onClick: () => onMove(1), children: _jsx(ArrowDown, { "aria-hidden": true }) }), _jsx(IconButton, { label: t("row.remove", { name }), size: "icon-xs", destructive: true, disabled: disabled, onClick: onRemove, children: _jsx(X, { "aria-hidden": true }) })] }));
}
/** An ordered list of names picked from `options`: add from the options not in the list yet, move, remove. Used for layout groups and list columns. */
export function OrderedNames({ label, names, options, onChange, nameOf, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const rest = options.filter((name) => !names.includes(name));
    const [adding, setAdding] = useState("");
    const show = nameOf ?? ((name) => name);
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("span", { className: "font-medium text-xs", children: label }), names.length === 0 && _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("names.none") }), _jsx("ul", { className: "flex flex-col gap-1", children: names.map((name, index) => (_jsxs("li", { className: "flex items-center justify-between rounded-md border bg-cms-background px-2 py-0.5 text-sm", children: [_jsx("span", { className: "truncate", children: show(name) }), _jsx(RowActions, { index: index, count: names.length, name: show(name), onMove: (delta) => onChange(moveItem(names, index, delta)), onRemove: () => onChange(names.filter((item) => item !== name)) })] }, name))) }), rest.length > 0 && !disabled && (_jsx("div", { className: "flex items-center gap-1.5", children: _jsxs(Select, { value: adding, items: rest.map((name) => ({ value: name, label: show(name) })), onValueChange: (next) => {
                        if (typeof next === "string" && next) {
                            onChange([...names, next]);
                            setAdding("");
                        }
                    }, children: [_jsx(SelectTrigger, { size: "sm", className: "w-full", "aria-label": t("names.add", { label }), children: _jsxs("span", { className: "flex items-center gap-1.5 text-cms-muted-foreground", children: [_jsx(Plus, { "aria-hidden": true, className: "size-3.5" }), _jsx(SelectValue, { placeholder: t("names.addPlaceholder") })] }) }), _jsx(SelectContent, { children: rest.map((name) => (_jsx(SelectItem, { value: name, children: show(name) }, name))) })] }) }))] }));
}
export function AddButton({ children, onClick, disabled: off, }) {
    const { disabled } = useSchemaEdit();
    return (_jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: disabled || off, onClick: onClick, children: [_jsx(Plus, { "aria-hidden": true }), children] }));
}
