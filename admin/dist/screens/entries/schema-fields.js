"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { ChevronRight, RefreshCw } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { isFieldInputParts, useCmsAdminComponents, } from "../../admin-components.js";
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
import { recordTranslationKey } from "./entry-form.js";
import { BacklinkInput, EntryPicker, inputClass, multilineProps, OrderedEntryList, } from "./field-inputs.js";
import { FieldView } from "./field-views.js";
import { layoutGroupsOf } from "./layout-groups.js";
import { MediaInput } from "./media-image-input.js";
import { entriesMessages } from "./messages.js";
import { optionOf, useRecordCreator } from "./record-create-sheet.js";
import { RelationCombobox } from "./relation-combobox.js";
import { useEntryFormSelector, useEntryFormStore, useField } from "./use-field.js";
import { useRelationSearch } from "./use-relation-search.js";
/**
 * Label, required mark, error and help of one field. If `slot` exists, a slot button goes next to the label and the result below the input.
 * All inputs in the properties panel use this row.
 */
export function FieldRow({ id, label, required, issue, help, slot, aside, children }) {
    const site = useSite();
    if (slot) {
        return (_jsx(SlotFieldRow, { id: id, label: label, required: required, issue: issue, help: help, slot: slot, aside: aside, children: children }));
    }
    const labelNode = (_jsxs(FieldLabel, { htmlFor: id, className: "font-semibold text-cms-muted-foreground text-xs", children: [label, " ", required && _jsx("span", { className: "text-cms-destructive", children: "*" })] }));
    return (_jsxs(UiField, { "data-invalid": Boolean(issue) || undefined, className: "gap-1.5", children: [aside ? (_jsxs("div", { className: "flex min-h-6 items-center justify-between gap-2", children: [labelNode, aside] })) : (labelNode), children, issue && _jsx(FieldError, { id: `${id}-error`, children: cmsIssueMessage(site, issue) }), help && _jsx(FieldDescription, { className: "text-[11px] leading-tight", children: help })] }));
}
function SlotFieldRow({ id, label, required, issue, help, slot, aside, children, }) {
    const site = useSite();
    const { trigger, panel } = useSlot(slot);
    return (_jsxs(UiField, { "data-invalid": Boolean(issue) || undefined, className: "gap-1.5", children: [_jsxs("div", { className: "flex min-h-6 items-center justify-between gap-2", children: [_jsxs(FieldLabel, { htmlFor: id, className: "font-semibold text-cms-muted-foreground text-xs", children: [label, " ", required && _jsx("span", { className: "text-cms-destructive", children: "*" })] }), aside || trigger ? (_jsxs("span", { className: "flex items-center gap-1", children: [aside, trigger] })) : null] }), children, panel, issue && _jsx(FieldError, { id: `${id}-error`, children: cmsIssueMessage(site, issue) }), help && _jsx(FieldDescription, { className: "text-[11px] leading-tight", children: help })] }));
}
/** Relation to a record target (category, tag, collection). Search and pick; with `createInline`, a missing name can be created right from the list. */
function RecordRelationInput({ field, id, value, invalid, describedBy, context, onChange }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    const relation = field;
    const selected = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
    // Published records, searched on the server as the user types; the picked ones are looked up by id so they keep their names.
    const records = useRelationSearch({ collection: relation.to, publishedOnly: true, selected });
    const creator = useRecordCreator();
    const options = useMemo(() => (records.options ?? []).map((option) => ({ value: option.id, label: option.title })), [records.options]);
    const known = useMemo(() => records.known.map((option) => ({ value: option.id, label: option.title })), [records.known]);
    return (_jsxs(_Fragment, { children: [_jsx(RelationCombobox, { id: id, multiple: Boolean(relation.many), "aria-label": relation.label, placeholder: relation.placeholder ?? (relation.createInline ? t("relation.searchOrAdd") : t("relation.search")), options: options, known: known, onSearch: records.search, loading: records.loading, value: selected, invalid: invalid, describedBy: describedBy, disabled: context.disabled, onValueChange: (next) => onChange(relation.many ? next : (next[0] ?? null)), onCreate: relation.createInline
                    ? async (title) => {
                        const saved = await creator.create(relation.to, title);
                        if (!saved)
                            return null;
                        records.remember({ ...optionOf(site, t, relation.to, saved), status: saved.status });
                        return saved.id;
                    }
                    : undefined }), records.error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: t("entry.loadFailed") })), creator.sheet] }));
}
/** Default input per field kind. If `input` points to a component, render it; otherwise render the input matching the kind. */
function DefaultInput({ parts, ...props }) {
    const t = useTranslator(entriesMessages);
    const site = useSite();
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
            // A value the site removed from the options is shown as the current value, marked, so it is not replaced silently.
            if (text && !Object.hasOwn(field.options, text)) {
                items.push({ value: text, label: t("select.removedOption", { value: text }) });
            }
            return (_jsxs(Select, { value: text || field.defaultValue, items: items, disabled: context.disabled, onValueChange: (next) => typeof next === "string" && onChange(next), children: [_jsx(SelectTrigger, { id: id, size: "sm", className: "w-full", "aria-describedby": describedBy, children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: items.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }));
        }
        case "relation":
            if (site.isItemCollection(field.to))
                return _jsx(RecordRelationInput, { ...props });
            return field.many ? _jsx(OrderedEntryList, { ...props }) : _jsx(EntryPicker, { ...props });
        case "media":
            return _jsx(MediaInput, { ...props });
    }
}
/** The entry a site registered under the field's `input` name, if any. */
function useRegisteredInput(field) {
    const { fieldInputs } = useCmsAdminComponents();
    const input = field.definition && "input" in field.definition ? field.definition.input : undefined;
    return input ? fieldInputs?.[input] : undefined;
}
/**
 * One value field: label row, default input (or the one a site registered), error, help and slot. It re-renders when its own value, error
 * or read-only state changes. An input a site registered may read the whole form (`FieldInputProps.form`), so only that case
 * subscribes to the form as a whole.
 */
const ValueRow = memo(function ValueRow({ name, showDescriptions }) {
    const field = useField(name);
    const registered = useRegisteredInput(field);
    if (!field.definition || field.hidden)
        return null;
    return registered ? (_jsx(FormBoundRow, { field: field, showDescriptions: showDescriptions })) : (_jsx(ValueRowView, { field: field, showDescriptions: showDescriptions }));
});
function FormBoundRow({ field, showDescriptions }) {
    const locked = field.readOnlyReason === "locked";
    const form = useEntryFormSelector((state) => (locked && state.locked ? state.locked.values : state.form));
    return _jsx(ValueRowView, { field: field, showDescriptions: showDescriptions, form: form });
}
function ValueRowView({ field, showDescriptions, form, }) {
    const store = useEntryFormStore();
    const collection = useEntryFormSelector((state) => state.collection);
    const entryId = useEntryFormSelector((state) => state.entryId);
    const locale = useEntryFormSelector((state) => state.locale);
    const entry = useEntryFormSelector((state) => state.entry);
    const { fieldInputs } = useCmsAdminComponents();
    const definition = field.definition;
    const locked = field.readOnlyReason === "locked";
    const state = store.getState();
    const props = {
        collection,
        // Built-in inputs do not read the form, so it is not subscribed to here (`FormBoundRow` does it for a registered input).
        form: form ?? (locked && state.locked ? state.locked.values : state.form),
        name: field.name,
        field: definition,
        id: field.ids.input,
        value: field.value,
        invalid: field.invalid,
        describedBy: field.inputProps["aria-describedby"],
        context: { entryId, locale, groupId: entry?.translationGroupId, disabled: field.readOnly, entry },
        onChange: field.setValue,
    };
    const help = locked ? field.lockedNote : showDescriptions ? field.description : undefined;
    // Input pieces registered by extensions (right of the label row, hint text, input override).
    const registered = definition.input ? fieldInputs?.[definition.input] : undefined;
    const parts = registered && isFieldInputParts(registered) ? registered : undefined;
    const Aside = parts?.Aside;
    const Input = parts?.Input;
    return (_jsx(FieldRow, { id: field.ids.input, label: field.label, required: field.required, issue: field.error?.issue, help: help, slot: Input === null ? undefined : (field.slotRequest ?? undefined), aside: Aside ? _jsx(Aside, { ...props }) : undefined, children: Input === null ? null : Input ? _jsx(Input, { ...props }) : _jsx(DefaultInput, { ...props, parts: parts }) }));
}
const SlugRow = memo(function SlugRow({ name, showDescriptions, onSlugChange, onRegenerateSlug, placeholder, }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    const field = useField(name);
    const collection = useEntryFormSelector((state) => state.collection);
    const definition = field.definition;
    const changeSlug = onSlugChange ?? field.setValue;
    const request = field.slotRequest;
    const slot = useMemo(() => (request ? { ...request, apply: (next) => changeSlug(next) } : undefined), [request, changeSlug]);
    const fromLabel = definition.from
        ? (site.schemaOf(collection).fields[definition.from]?.label ?? definition.from)
        : "";
    const regenerateLabel = t("relation.regenerate", { label: fromLabel });
    return (_jsx(FieldRow, { id: field.ids.input, label: field.label, required: field.required, issue: field.error?.issue, help: showDescriptions ? field.description : undefined, slot: slot, children: _jsxs(InputGroup, { className: "h-8", children: [_jsx(InputGroupInput, { id: field.ids.input, autoComplete: "off", "aria-invalid": field.inputProps["aria-invalid"], "aria-describedby": field.inputProps["aria-describedby"], value: field.value ?? "", onChange: (event) => changeSlug(event.target.value), placeholder: placeholder ?? definition.placeholder, className: "font-mono text-xs md:text-xs" }), onRegenerateSlug && definition.from && (_jsx(InputGroupAddon, { align: "inline-end", children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(InputGroupButton, { size: "icon-xs", "aria-label": regenerateLabel, disabled: field.readOnly, onClick: onRegenerateSlug }), children: _jsx(RefreshCw, { "aria-hidden": true }) }), _jsx(TooltipContent, { side: "bottom", children: regenerateLabel })] }) }))] }) }));
});
/** A conditional field: its choice, then the fields that belong to the chosen option. */
const ConditionalRow = memo(function ConditionalRow({ name, showDescriptions }) {
    const site = useSite();
    const collection = useEntryFormSelector((state) => state.collection);
    const choice = useField(name);
    const field = site.schemaOf(collection).fields[name];
    const selected = typeof choice.value === "string" ? choice.value : field.discriminant.defaultValue;
    const nested = field.values[selected] ?? {};
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(ValueRow, { name: name, showDescriptions: showDescriptions }), Object.keys(nested).map((nestedName) => (_jsx(ValueRow, { name: nestedName, showDescriptions: showDescriptions }, nestedName)))] }));
});
const ViewRow = memo(function ViewRow({ name, showDescriptions }) {
    const site = useSite();
    const collection = useEntryFormSelector((state) => state.collection);
    const form = useEntryFormSelector((state) => state.form);
    const entry = useEntryFormSelector((state) => state.entry);
    const field = site.schemaOf(collection).fields[name];
    if (field.hidden)
        return null;
    const view = _jsx(FieldView, { view: field.view, collection: collection, form: form, entry: entry });
    return field.label ? (_jsx(FieldRow, { id: `cms-${name}`, label: field.label, help: showDescriptions ? field.description : undefined, children: view })) : (view);
});
const BacklinkRow = memo(function BacklinkRow({ name, showDescriptions, references, }) {
    const site = useSite();
    const collection = useEntryFormSelector((state) => state.collection);
    const locked = useEntryFormSelector((state) => state.locked);
    const disabled = useEntryFormSelector((state) => state.disabled);
    const entryId = useEntryFormSelector((state) => state.entryId);
    const groupId = useEntryFormSelector((state) => state.entry?.translationGroupId);
    const field = site.schemaOf(collection).fields[name];
    // On a translation, the original's value is only shown (relations point to the original).
    const readOnly = Boolean(locked);
    const targetId = groupId ?? entryId;
    return (_jsx(FieldRow, { id: `cms-${name}`, label: field.label, help: locked ? locked.note : showDescriptions ? field.description : undefined, children: _jsx(BacklinkInput, { field: field, targetId: targetId, disabled: disabled || readOnly, shared: targetId === entryId && references
                ? { references: references.items, loading: references.loading, refresh: references.refresh }
                : undefined }) }));
});
/**
 * Reads the collection definition and renders property inputs. Follows the group order of the layout (`layout`),
 * and renders fields not in the layout after the last group in declaration order. For a conditional field, shows its dependent input when the condition holds.
 * The values, issues and read-only state come from the nearest `EntryFormProvider`; each field row reads them with `useField`.
 */
export function SchemaFields({ onSlugChange, onRegenerateSlug, slugPlaceholder, omit = [], showDescriptions = true, include, sections = "collapsible", references, }) {
    const site = useSite();
    const store = useEntryFormStore();
    const collection = useEntryFormSelector((state) => state.collection);
    const schema = site.schemaOf(collection);
    const renderField = (name) => {
        if (omit.includes(name))
            return null;
        const field = schema.fields[name];
        if (!field)
            return null;
        switch (field.kind) {
            case "slug":
                return (_jsx(SlugRow, { name: name, showDescriptions: showDescriptions, onSlugChange: onSlugChange, onRegenerateSlug: onRegenerateSlug, placeholder: slugPlaceholder }, name));
            case "conditional":
                return _jsx(ConditionalRow, { name: name, showDescriptions: showDescriptions }, name);
            case "view":
                return _jsx(ViewRow, { name: name, showDescriptions: showDescriptions }, name);
            case "backlink":
                return _jsx(BacklinkRow, { name: name, showDescriptions: showDescriptions, references: references }, name);
            default:
                return _jsx(ValueRow, { name: name, showDescriptions: showDescriptions }, name);
        }
    };
    const groups = layoutGroupsOf(site, collection).filter((group) => !include || include(group));
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
                defaultOpen: () => !group.collapsed ||
                    visible.some((name) => {
                        const { form, issues } = store.getState();
                        const value = form[name];
                        return (issues.some((issue) => issue.path === name) ||
                            (Array.isArray(value) ? value.length > 0 : Boolean(value)));
                    }), children: visible.map(renderField) }, key));
        }) }));
}
function LayoutSection({ title, defaultOpen, children, }) {
    const [open, setOpen] = useState(defaultOpen);
    return (_jsx(Collapsible, { open: open, onOpenChange: setOpen, children: _jsxs(FieldSet, { className: "gap-3", children: [_jsx(FieldLegend, { variant: "label", className: "mb-0", children: _jsxs(CollapsibleTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "xs", className: "-ml-2 font-semibold text-cms-muted-foreground text-xs" }), children: [_jsx(ChevronRight, { className: `transition-transform ${open ? "rotate-90" : ""}` }), title] }) }), _jsx(CollapsibleContent, { className: "space-y-4", children: children })] }) }));
}
/**
 * One language's values of a record collection (category, tag, collection). Used by the language tab of the category edit panel.
 * If left empty, that language's page also uses the default language value. Reads the form from the nearest `EntryFormProvider`.
 */
export function RecordLocaleFields({ collection, locale }) {
    const site = useSite();
    return (_jsx("div", { className: "space-y-4", children: site.recordLocalizedFields(collection).map((name) => (_jsx(RecordLocaleField, { collection: collection, name: name, locale: locale }, name))) }));
}
function RecordLocaleField({ collection, name, locale, }) {
    const site = useSite();
    const field = useField(recordTranslationKey(name, locale));
    const definition = site.schemaOf(collection).fields[name];
    // The language tab of the category sheet is already visible, so the label is the base field's.
    const label = definition?.label ?? name;
    const multiline = definition?.kind === "text" && definition.multiline;
    const value = typeof field.value === "string" ? field.value : "";
    return (_jsx(FieldRow, { id: field.ids.input, label: label, children: multiline ? (_jsx(Textarea, { id: field.ids.input, ...multilineProps(definition), autoComplete: "off", lang: locale, value: value, disabled: field.readOnly, onChange: (event) => field.setValue(event.target.value), className: "resize-none text-xs md:text-xs" })) : (_jsx(Input, { id: field.ids.input, autoComplete: "off", lang: locale, value: value, disabled: field.readOnly, onChange: (event) => field.setValue(event.target.value), className: inputClass })) }));
}
