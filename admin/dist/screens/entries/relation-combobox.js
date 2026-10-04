"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxValue, useComboboxAnchor, } from "../../ui/combobox.js";
import { t } from "./translate.js";
/**
 * Relation input such as tags and categories. Search and pick; for a name that does not exist, `Add 'name'` at the end of the list opens the add sheet
 * (no separate "new item" input row).
 */
export function RelationCombobox({ options, multiple, value, onValueChange, onCreate, id, placeholder, "aria-label": ariaLabel, invalid, describedBy, disabled, showChips = true, }) {
    const anchor = useComboboxAnchor();
    const [query, setQuery] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState(null);
    const byValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
    // A selected value not yet in the list (e.g. just created) is shown by a short ID instead of a name. Base UI resets
    // the input text to the picked name when the value object changes, so pass the same object for the same selection.
    const valueKey = value.join("\u0000");
    // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the joined ids
    const selected = useMemo(() => value.map((item) => byValue.get(item) ?? { value: item, label: item.slice(0, 8) }), [valueKey, byValue]);
    const trimmed = query.trim();
    const canCreate = Boolean(onCreate) &&
        !isCreating &&
        trimmed !== "" &&
        // Do not create if the picked item's name is shown in the input (single-pick relation) or the name already exists.
        ![...options, ...selected].some((option) => option.label.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    const items = canCreate
        ? [...options, { value: `__create__:${trimmed}`, label: trimmed, create: true }]
        : [...options];
    const create = async (label, keep) => {
        if (!onCreate)
            return;
        setIsCreating(true);
        setError(null);
        try {
            const createdId = await onCreate(label);
            if (createdId === null)
                return;
            onValueChange([...keep, createdId]);
            setQuery("");
        }
        catch (caught) {
            setError(caught instanceof Error && caught.message ? caught.message : t("relation.addFailed"));
        }
        finally {
            setIsCreating(false);
        }
    };
    const list = (_jsxs(ComboboxContent, { anchor: multiple ? anchor : undefined, children: [_jsx(ComboboxEmpty, { children: t("relation.empty") }), _jsx(ComboboxList, { children: (item) => (_jsx(ComboboxItem, { value: item, className: cn(item.create && "text-cms-primary"), children: item.create ? (_jsxs(_Fragment, { children: [_jsx(Plus, { "aria-hidden": true }), _jsx("span", { className: "truncate", children: t("relation.create", { label: item.label }) })] })) : (_jsx("span", { className: "truncate", children: item.label })) }, item.value)) })] }));
    const errorText = error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: error }));
    if (multiple) {
        return (_jsxs(_Fragment, { children: [_jsxs(Combobox, { items: items, multiple: true, autoHighlight: true, disabled: disabled || isCreating, value: selected, onValueChange: (next) => {
                        const created = next.find((item) => item.create);
                        const keep = next.filter((item) => !item.create).map((item) => item.value);
                        if (created)
                            void create(created.label, keep);
                        else
                            onValueChange(keep);
                    }, onInputValueChange: setQuery, itemToStringLabel: (item) => item.label, isItemEqualToValue: (a, b) => a.value === b.value, children: [_jsxs(ComboboxChips, { ref: anchor, className: "w-full min-w-0", children: [_jsx(ComboboxValue, { children: (showChips ? selected : []).map((item) => (_jsx(ComboboxChip, { className: "max-w-full", children: _jsx("span", { className: "truncate", children: item.label }) }, item.value))) }), _jsx(ComboboxChipsInput, { id: id, "aria-label": ariaLabel, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, placeholder: selected.length === 0 || !showChips ? placeholder : undefined, className: "text-xs" })] }), list] }), errorText] }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs(Combobox, { items: items, autoHighlight: true, disabled: disabled || isCreating, value: selected[0] ?? null, onValueChange: (next) => {
                    if (next?.create)
                        void create(next.label, []);
                    else
                        onValueChange(next ? [next.value] : []);
                }, onInputValueChange: setQuery, itemToStringLabel: (item) => item.label, isItemEqualToValue: (a, b) => a.value === b.value, children: [_jsx(ComboboxInput, { id: id, "aria-label": ariaLabel, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, placeholder: placeholder, showClear: selected.length > 0, disabled: disabled || isCreating, className: "h-8 w-full text-xs [&_input]:text-xs" }), list] }), errorText] }));
}
