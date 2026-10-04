"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { isItemCollection, recordLocalizedFields, roleValue, schemaOf, } from "@monti-cms/core/client";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { isFieldInputParts, useCmsAdminComponents } from "../../admin-components.js";
import { useSlot } from "../../slots/slots.js";
import { Button } from "../../ui/button.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible.js";
import { FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet, Field as UiField } from "../../ui/field.js";
import { Input } from "../../ui/input.js";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../../ui/input-group.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Textarea } from "../../ui/textarea.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip.js";
import { cmsIssueMessage } from "../api-error-message.js";
import { useTaxonomy } from "../shared/use-taxonomy.js";
import { recordTranslationKey } from "./entry-form.js";
import { BacklinkInput, EntryPicker, inputClass, multilineProps, OrderedEntryList, } from "./field-inputs.js";
import { FieldView } from "./field-views.js";
import { layoutGroupsOf } from "./layout-groups.js";
import { MediaInput } from "./media-image-input.js";
import { optionOf, useRecordCreator } from "./record-create-sheet.js";
import { RelationCombobox } from "./relation-combobox.js";
import { t } from "./translate.js";
const fieldId = (name) => `cms-${name}`;
/**
 * Label, required mark, error and help of one field. If `slot` exists, a slot button goes next to the label and the result below the input.
 * All inputs in the properties panel use this row.
 */
export function FieldRow({ id, label, required, issue, help, slot, aside, children }) {
    if (slot) {
        return (_jsx(SlotFieldRow, { id: id, label: label, required: required, issue: issue, help: help, slot: slot, aside: aside, children: children }));
    }
    const labelNode = (_jsxs(FieldLabel, { htmlFor: id, className: "font-semibold text-cms-muted-foreground text-xs", children: [label, " ", required && _jsx("span", { className: "text-cms-destructive", children: "*" })] }));
    return (_jsxs(UiField, { "data-invalid": Boolean(issue) || undefined, className: "gap-1.5", children: [aside ? (_jsxs("div", { className: "flex min-h-6 items-center justify-between gap-2", children: [labelNode, aside] })) : (labelNode), children, issue && _jsx(FieldError, { id: `${id}-error`, children: cmsIssueMessage(issue) }), help && _jsx(FieldDescription, { className: "text-[11px] leading-tight", children: help })] }));
}
function SlotFieldRow({ id, label, required, issue, help, slot, aside, children, }) {
    const { trigger, panel } = useSlot(slot);
    return (_jsxs(UiField, { "data-invalid": Boolean(issue) || undefined, className: "gap-1.5", children: [_jsxs("div", { className: "flex min-h-6 items-center justify-between gap-2", children: [_jsxs(FieldLabel, { htmlFor: id, className: "font-semibold text-cms-muted-foreground text-xs", children: [label, " ", required && _jsx("span", { className: "text-cms-destructive", children: "*" })] }), aside || trigger ? (_jsxs("span", { className: "flex items-center gap-1", children: [aside, trigger] })) : null] }), children, panel, issue && _jsx(FieldError, { id: `${id}-error`, children: cmsIssueMessage(issue) }), help && _jsx(FieldDescription, { className: "text-[11px] leading-tight", children: help })] }));
}
/** Relation to a record target (category, tag, collection). Search and pick; with `createInline`, a missing name can be created right from the list. */
function RecordRelationInput({ field, id, value, invalid, describedBy, context, onChange }) {
    const relation = field;
    const records = useTaxonomy(relation.to);
    const creator = useRecordCreator();
    const selected = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
    const options = useMemo(() => records.options.map((option) => ({ value: option.id, label: option.title })), [records.options]);
    return (_jsxs(_Fragment, { children: [_jsx(RelationCombobox, { id: id, multiple: Boolean(relation.many), "aria-label": relation.label, placeholder: relation.placeholder ?? (relation.createInline ? t("relation.searchOrAdd") : t("relation.search")), options: options, value: selected, invalid: invalid, describedBy: describedBy, disabled: context.disabled, onValueChange: (next) => onChange(relation.many ? next : (next[0] ?? null)), onCreate: relation.createInline
                    ? async (title) => {
                        const saved = await creator.create(relation.to, { title });
                        if (!saved)
                            return null;
                        records.remember(optionOf(saved));
                        void records.reload();
                        return saved.id;
                    }
                    : undefined }), records.error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: records.error })), creator.sheet] }));
}
/** Default input per field kind. If `input` points to a component, render it; otherwise render the input matching the kind. */
function DefaultInput({ parts, ...props }) {
    const { field, id, value, invalid, describedBy, context, onChange } = props;
    const { fieldInputs } = useCmsAdminComponents();
    const registered = field.input ? fieldInputs?.[field.input] : undefined;
    if (registered && !isFieldInputParts(registered)) {
        const Custom = registered;
        return _jsx(Custom, { ...props });
    }
    const text = typeof value === "string" ? value : "";
    const placeholder = parts?.placeholder?.(props) ?? (field.kind === "text" || field.kind === "media" ? field.placeholder : undefined);
    switch (field.kind) {
        case "text":
            return field.multiline ? (_jsx(Textarea, { id: id, ...multilineProps(field), autoComplete: "off", value: text, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, placeholder: placeholder, onChange: (event) => onChange(event.target.value), className: "resize-none text-xs md:text-xs" })) : (_jsx(Input, { id: id, autoComplete: "off", value: text, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, placeholder: placeholder, onChange: (event) => onChange(event.target.value), className: inputClass }));
        case "select": {
            const items = Object.entries(field.options).map(([optionValue, label]) => ({ value: optionValue, label }));
            return (_jsxs(Select, { value: text || field.defaultValue, items: items, disabled: context.disabled, onValueChange: (next) => typeof next === "string" && onChange(next), children: [_jsx(SelectTrigger, { id: id, size: "sm", className: "w-full", "aria-describedby": describedBy, children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: items.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }));
        }
        case "relation":
            if (isItemCollection(field.to))
                return _jsx(RecordRelationInput, { ...props });
            return field.many ? _jsx(OrderedEntryList, { ...props }) : _jsx(EntryPicker, { ...props });
        case "media":
            return _jsx(MediaInput, { ...props });
    }
}
/**
 * Reads the collection definition and renders property inputs. Follows the group order of the layout (`layout`),
 * and renders fields not in the layout after the last group in declaration order. For a conditional field, shows its dependent input when the condition holds.
 */
export function SchemaFields({ collection, form, issues = [], context, onChange, onSlugChange, onRegenerateSlug, slugPlaceholder, omit = [], showDescriptions = true, locked, include, sections = "collapsible", }) {
    const schema = schemaOf(collection);
    const { fieldInputs } = useCmsAdminComponents();
    const issueFor = (path) => issues.find((issue) => issue.path === path);
    const describedBy = (path) => (issueFor(path) ? `${fieldId(path)}-error` : undefined);
    const setValue = (name, value) => onChange({ [name]: value });
    /** Slot next to a field. Not placed on read-only fields. Applying is the same as changing the input. */
    const fieldSlot = (name, value, apply) => ({
        slot: "field",
        target: name,
        collection,
        scope: context.entryId ?? "new",
        disabled: context.disabled,
        getContext: () => ({
            collection,
            locale: context.locale,
            entryId: context.entryId,
            title: form.title,
            summary: roleValue(collection, "summary", form) || undefined,
            body: form.mdx,
            current: Array.isArray(value) ? value : typeof value === "string" ? value : undefined,
        }),
        apply: (next, mode) => {
            if (mode === "append") {
                const list = Array.isArray(value) ? value : [];
                if (!list.includes(next))
                    apply([...list, next]);
            }
            else
                apply(next);
        },
    });
    /** Whether this is a shared field showing the original's value on a translation. */
    const isLocked = (field) => Boolean(locked) && field.kind !== "backlink" && field.kind !== "view" && !field.localized;
    const renderValue = (name, field, readOnly = false) => {
        if (field.hidden)
            return null;
        const issue = readOnly ? undefined : issueFor(name);
        const source = readOnly && locked ? locked.values : form;
        const props = {
            collection,
            form: source,
            name,
            field,
            id: fieldId(name),
            value: name === "title" ? source.title : (source[name] ?? null),
            invalid: Boolean(issue),
            describedBy: describedBy(name),
            context: readOnly ? { ...context, disabled: true } : context,
            onChange: readOnly ? () => { } : (value) => setValue(name, value),
        };
        const help = readOnly && locked ? locked.note : showDescriptions ? field.description : undefined;
        // Input pieces registered by extensions (right of the label row, hint text, input override).
        const registered = field.input ? fieldInputs?.[field.input] : undefined;
        const parts = registered && isFieldInputParts(registered) ? registered : undefined;
        const Aside = parts?.Aside;
        const Input = parts?.Input;
        return (_jsx(FieldRow, { id: fieldId(name), label: field.label, required: Boolean(field.required) && !readOnly, issue: issue, help: help, slot: readOnly || Input === null ? undefined : fieldSlot(name, props.value, props.onChange), aside: Aside ? _jsx(Aside, { ...props }) : undefined, children: Input === null ? null : Input ? _jsx(Input, { ...props }) : _jsx(DefaultInput, { ...props, parts: parts }) }, name));
    };
    const renderSlug = (name, field) => {
        const issue = issueFor(name);
        const fromLabel = field.from ? (schema.fields[field.from]?.label ?? field.from) : "";
        const regenerateLabel = t("relation.regenerate", { label: fromLabel });
        return (_jsx(FieldRow, { id: fieldId(name), label: field.label, required: Boolean(field.required), issue: issue, help: showDescriptions ? field.description : undefined, slot: fieldSlot(name, form.slug, (slug) => (onSlugChange ?? ((next) => onChange({ slug: next })))(typeof slug === "string" ? slug : "")), children: _jsxs(InputGroup, { className: "h-8", children: [_jsx(InputGroupInput, { id: fieldId(name), autoComplete: "off", "aria-invalid": Boolean(issue) || undefined, "aria-describedby": describedBy(name), value: form.slug, onChange: (event) => (onSlugChange ?? ((slug) => onChange({ slug })))(event.target.value), placeholder: slugPlaceholder ?? field.placeholder, className: "font-mono text-xs md:text-xs" }), onRegenerateSlug && field.from && (_jsx(InputGroupAddon, { align: "inline-end", children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(InputGroupButton, { size: "icon-xs", "aria-label": regenerateLabel, disabled: context.disabled, onClick: onRegenerateSlug }), children: _jsx(RefreshCw, { "aria-hidden": true }) }), _jsx(TooltipContent, { side: "bottom", children: regenerateLabel })] }) }))] }) }, name));
    };
    const renderConditional = (name, field) => {
        const readOnly = isLocked(field);
        const source = readOnly && locked ? locked.values : form;
        const selected = typeof source[name] === "string" ? source[name] : field.discriminant.defaultValue;
        const nested = field.values[selected] ?? {};
        return (_jsxs("div", { className: "space-y-3", children: [renderValue(name, field.discriminant, readOnly), Object.entries(nested).map(([nestedName, nestedField]) => renderValue(nestedName, nestedField, readOnly))] }, name));
    };
    const renderField = (name) => {
        if (omit.includes(name))
            return null;
        const field = schema.fields[name];
        if (!field)
            return null;
        if (field.kind === "slug")
            return renderSlug(name, field);
        if (field.kind === "conditional")
            return renderConditional(name, field);
        if (field.kind === "view") {
            if (field.hidden)
                return null;
            const view = (_jsx(FieldView, { view: field.view, collection: collection, form: form, entry: context.entry ?? null }, name));
            return field.label ? (_jsx(FieldRow, { id: fieldId(name), label: field.label, help: showDescriptions ? field.description : undefined, children: view }, name)) : (view);
        }
        if (field.kind === "backlink") {
            // On a translation, the original's value is only shown (relations point to the original).
            const readOnly = Boolean(locked);
            const targetId = context.groupId ?? context.entryId;
            return (_jsx(FieldRow, { id: fieldId(name), label: field.label, help: readOnly && locked ? locked.note : showDescriptions ? field.description : undefined, children: _jsx(BacklinkInput, { field: field, targetId: targetId, disabled: context.disabled || readOnly, shared: targetId === context.entryId && context.incomingReferences && context.refreshIncomingReferences
                        ? {
                            references: context.incomingReferences,
                            loading: Boolean(context.incomingReferencesLoading),
                            refresh: context.refreshIncomingReferences,
                        }
                        : undefined }) }, name));
        }
        return renderValue(name, field, isLocked(field));
    };
    const groups = layoutGroupsOf(collection).filter((group) => !include || include(group));
    return (_jsx(_Fragment, { children: groups.map((group, index) => {
            const visible = group.fields.filter((name) => {
                const field = schema.fields[name];
                return field && !omit.includes(name) && !(field.kind !== "conditional" && "hidden" in field && field.hidden);
            });
            if (visible.length === 0)
                return null;
            const key = `${group.group ?? "group"}-${index}`;
            if (!group.group) {
                return (_jsx("div", { className: "space-y-4", children: visible.map(renderField) }, key));
            }
            if (sections === "plain") {
                // If there is only one group (one group in one tab), no title is added.
                if (groups.length === 1) {
                    return (_jsx("div", { className: "space-y-4", children: visible.map(renderField) }, key));
                }
                return (_jsxs("section", { "aria-label": group.group, className: "space-y-4 border-t pt-4", children: [_jsx("h3", { className: "font-medium text-[11px] text-cms-muted-foreground uppercase tracking-wide", children: group.group }), visible.map(renderField)] }, key));
            }
            return (_jsx(LayoutSection, { title: group.group, 
                // A group with values or publish problems is not collapsed.
                defaultOpen: !group.collapsed ||
                    visible.some((name) => {
                        const value = form[name];
                        return Boolean(issueFor(name)) || (Array.isArray(value) ? value.length > 0 : Boolean(value));
                    }), children: visible.map(renderField) }, key));
        }) }));
}
function LayoutSection({ title, defaultOpen, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (_jsx(Collapsible, { open: open, onOpenChange: setOpen, children: _jsxs(FieldSet, { className: "gap-3", children: [_jsx(FieldLegend, { variant: "label", className: "mb-0", children: _jsxs(CollapsibleTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "xs", className: "-ml-2 font-semibold text-cms-muted-foreground text-xs" }), children: [_jsx(ChevronRight, { className: `transition-transform ${open ? "rotate-90" : ""}` }), title] }) }), _jsx(CollapsibleContent, { className: "space-y-4", children: children })] }) }));
}
/**
 * Other-language name and description of a record collection (category, tag, collection). If empty, the public page uses the default language value.
 */
/**
 * One language's values of a record collection (category, tag, collection). Used by the language tab of the category edit panel.
 * If left empty, that language's page also uses the default language value.
 */
export function RecordLocaleFields({ collection, locale, form, disabled, onChange, }) {
    const schema = schemaOf(collection);
    return (_jsx("div", { className: "space-y-4", children: recordLocalizedFields(collection).map((field) => {
            const key = recordTranslationKey(field, locale);
            const definition = schema.fields[field];
            // The language tab of the category sheet is already visible.
            const label = definition?.label ?? field;
            const multiline = definition?.kind === "text" && definition.multiline;
            const value = typeof form[key] === "string" ? form[key] : "";
            return (_jsx(FieldRow, { id: fieldId(key), label: label, children: multiline ? (_jsx(Textarea, { id: fieldId(key), ...multilineProps(definition), autoComplete: "off", lang: locale, value: value, disabled: disabled, onChange: (event) => onChange({ [key]: event.target.value }), className: "resize-none text-xs md:text-xs" })) : (_jsx(Input, { id: fieldId(key), autoComplete: "off", lang: locale, value: value, disabled: disabled, onChange: (event) => onChange({ [key]: event.target.value }), className: inputClass })) }, key));
        }) }));
}
