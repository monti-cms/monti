"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible.js";
import { Input } from "../../ui/input.js";
import { Textarea } from "../../ui/textarea.js";
import { AddButton, countOrUndefined, FlagSwitch, IssueList, Labeled, NameInput, orUndefined, Pick, RowActions, TextInput, useIssuesUnder, useSchemaEdit, } from "./controls.js";
import { schemaMessages } from "./messages.js";
import { addField, addOption, allFieldNames, FIELD_KEY_ORDER, FIELD_KINDS, fieldsOf, isObj, moveField, moveOption, newField, optionsOf, removeField, removeOption, renameField, renameOption, setDefaultOption, setField, setOptionLabel, setProp, setTitleField, titleFieldName, VALUE_KINDS, withKind, } from "./schema-model.js";
/** The options of a select (or of the select a conditional field shows): value, label, default, order. */
function OptionsEditor({ field, fieldName, editing, change, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const options = optionsOf(field);
    const values = Object.keys(options);
    const select = field.kind === "conditional" && isObj(field.discriminant) ? field.discriminant : field;
    const [draftValue, setDraftValue] = useState("");
    const taken = (value) => values.filter((item) => item !== value);
    const addable = draftValue !== "" && /^[A-Za-z0-9_-]+$/.test(draftValue) && !values.includes(draftValue);
    return (_jsxs("fieldset", { className: "flex flex-col gap-1.5", children: [_jsx("legend", { className: "font-medium text-xs", children: t("options.title") }), _jsx("ul", { className: "flex flex-col gap-1.5", children: values.map((value, index) => (_jsxs("li", { className: "flex flex-wrap items-end gap-2 rounded-md border bg-cms-background p-2", children: [_jsx(NameInput, { label: t("options.value"), value: value, taken: taken(value), className: "w-32 flex-none", onCommit: (to) => {
                                change((current) => renameOption(current, value, to));
                                editing.onRename({
                                    kind: "option",
                                    collection: editing.collectionName,
                                    field: fieldName,
                                    from: value,
                                    to,
                                });
                            } }), _jsx(TextInput, { label: t("options.label"), value: options[value], className: "min-w-32 flex-1", onChange: (label) => change((current) => setOptionLabel(current, value, label)) }), _jsxs("label", { className: "flex items-center gap-1.5 pb-2 text-xs", children: [_jsx("input", { type: "radio", name: `default-${fieldName}`, checked: select.defaultValue === value, disabled: disabled, onChange: () => change((current) => setDefaultOption(current, value)) }), t("options.default")] }), _jsx(RowActions, { index: index, count: values.length, name: value, onMove: (delta) => change((current) => moveOption(current, value, delta)), onRemove: () => change((current) => removeOption(current, value)) })] }, value))) }), !disabled && (_jsxs("div", { className: "flex items-end gap-2", children: [_jsx(Labeled, { label: t("options.newValue"), className: "w-40", children: _jsx(Input, { value: draftValue, placeholder: "value", onChange: (event) => setDraftValue(event.target.value) }) }), _jsx(Button, { type: "button", variant: "outline", size: "sm", disabled: !addable, onClick: () => {
                            change((current) => addOption(current, draftValue, draftValue.charAt(0).toUpperCase() + draftValue.slice(1)));
                            setDraftValue("");
                        }, children: t("options.add") })] }))] }));
}
/** `inputOptions`: a JSON object of text, number and flag values, checked when the writer leaves the box. */
function InputOptionsEditor({ value, onChange }) {
    const t = useTranslator(schemaMessages);
    const id = useId();
    const { disabled } = useSchemaEdit();
    const [text, setText] = useState(isObj(value) ? JSON.stringify(value) : "");
    const [bad, setBad] = useState(false);
    const commit = () => {
        if (text.trim() === "") {
            setBad(false);
            onChange(undefined);
            return;
        }
        try {
            const parsed = JSON.parse(text);
            const ok = isObj(parsed) && Object.values(parsed).every((item) => ["string", "number", "boolean"].includes(typeof item));
            setBad(!ok);
            if (ok)
                onChange(parsed);
        }
        catch {
            setBad(true);
        }
    };
    return (_jsxs(Labeled, { label: t("field.inputOptions"), htmlFor: id, hint: t("field.inputOptionsHint"), children: [_jsx(Textarea, { id: id, rows: 2, value: text, disabled: disabled, "aria-invalid": bad || undefined, className: "font-mono text-xs", onChange: (event) => setText(event.target.value), onBlur: commit }), bad && _jsx("p", { className: "text-cms-destructive text-xs", children: t("field.inputOptionsBad") })] }));
}
/** What the kind of the field adds: its own options. */
function KindOptions({ name, field, editing, set, change, }) {
    const t = useTranslator(schemaMessages);
    const { collectionNames, file } = useSchemaEdit();
    const placeholder = (_jsx(TextInput, { label: t("field.placeholder"), value: field.placeholder, onChange: (value) => set("placeholder", orUndefined(value)) }));
    const collections = collectionNames.map((value) => ({ value, label: value }));
    switch (field.kind) {
        case "text": {
            const fill = field.fillFromBody;
            return (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(FlagSwitch, { label: t("field.multiline"), checked: field.multiline === true, onChange: (on) => set("multiline", on ? true : undefined) }), field.multiline === true && (_jsx(TextInput, { label: t("field.rows"), type: "number", value: field.rows, onChange: (value) => set("rows", countOrUndefined(value)) })), _jsx(TextInput, { label: t("field.max"), type: "number", value: field.max, onChange: (value) => set("max", countOrUndefined(value)) }), _jsx(FlagSwitch, { label: t("field.fillFromBody"), hint: t("field.fillFromBodyHint"), checked: Boolean(fill), onChange: (on) => set("fillFromBody", on ? true : undefined) }), Boolean(fill) && (_jsx(TextInput, { label: t("field.fillLength"), type: "number", value: isObj(fill) ? fill.maxLength : undefined, placeholder: "160", onChange: (value) => {
                            const maxLength = countOrUndefined(value);
                            set("fillFromBody", maxLength === undefined ? true : { maxLength });
                        } })), placeholder] }));
        }
        case "slug": {
            const texts = Object.entries(fieldsOf(editing.collection))
                .filter(([, item]) => item.kind === "text")
                .map(([key]) => ({ value: key, label: key }));
            return (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Pick, { label: t("field.slugFrom"), hint: t("field.slugFromHint"), value: typeof field.from === "string" ? field.from : "", items: [{ value: "", label: t("none") }, ...texts], onChange: (value) => set("from", orUndefined(value)) }), placeholder] }));
        }
        case "relation":
            return (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Pick, { label: t("field.relationTo"), value: typeof field.to === "string" ? field.to : "", items: collections, onChange: (value) => set("to", value) }), placeholder, _jsx(FlagSwitch, { label: t("field.many"), checked: field.many === true, onChange: (on) => set("many", on ? true : undefined) }), field.many === true && (_jsx(FlagSwitch, { label: t("field.ordered"), hint: t("field.orderedHint"), checked: field.ordered === true, onChange: (on) => set("ordered", on ? true : undefined) })), _jsx(FlagSwitch, { label: t("field.createInline"), checked: field.createInline === true, onChange: (on) => set("createInline", on ? true : undefined) }), _jsx(FlagSwitch, { label: t("field.publishedOnly"), checked: field.publishedOnly === true, onChange: (on) => set("publishedOnly", on ? true : undefined) }), _jsx(FlagSwitch, { label: t("field.allowUnpublished"), checked: field.allowUnpublished === true, onChange: (on) => set("allowUnpublished", on ? true : undefined) })] }));
        case "select":
            return _jsx(OptionsEditor, { field: field, fieldName: name, editing: editing, change: change });
        case "media":
            return (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Pick, { label: t("field.accept"), value: field.accept ?? "image", items: [
                            { value: "image", label: t("field.acceptImage") },
                            { value: "file", label: t("field.acceptFile") },
                        ], onChange: (value) => set("accept", value === "image" ? undefined : value) }), placeholder] }));
        case "backlink": {
            const from = typeof field.from === "string" ? field.from : "";
            const target = isObj(file.collections) ? file.collections[from] : undefined;
            const relations = Object.entries(target ? fieldsOf(target) : {})
                .filter(([, item]) => item.kind === "relation" && item.many === true)
                .map(([key]) => ({ value: key, label: key }));
            return (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Pick, { label: t("field.backlinkFrom"), value: from, items: collections, onChange: (value) => set("from", value) }), _jsx(Pick, { label: t("field.backlinkVia"), hint: t("field.backlinkViaHint"), value: typeof field.via === "string" ? field.via : "", items: relations, onChange: (value) => set("via", value) }), _jsx(FlagSwitch, { label: t("field.createInline"), checked: field.createInline === true, onChange: (on) => set("createInline", on ? true : undefined) }), placeholder] }));
        }
        case "view":
            return (_jsx(TextInput, { label: t("field.view"), hint: t("field.viewHint"), value: field.view, onChange: (value) => set("view", value) }));
        case "conditional": {
            const options = optionsOf(field);
            const values = isObj(field.values) ? field.values : {};
            return (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx(OptionsEditor, { field: field, fieldName: name, editing: editing, change: change }), _jsx("div", { className: "flex flex-col gap-2", children: Object.keys(options).map((option) => (_jsxs("div", { className: "flex flex-col gap-2 rounded-md border border-dashed p-2", children: [_jsx("span", { className: "font-medium text-xs", children: t("field.whenOption", { option: options[option] ?? option }) }), _jsx(FieldList, { editing: editing, place: { branch: { field: name, option } }, fields: values[option] ?? {}, kinds: VALUE_KINDS })] }, option))) })] }));
        }
        default:
            return null;
    }
}
const LOCALIZED_KINDS = ["text", "slug", "relation", "select", "media", "conditional"];
export function FieldEditor({ editing, place, name, field, index, count, }) {
    const t = useTranslator(schemaMessages);
    const { disabled, collectionNames } = useSchemaEdit();
    const [open, setOpen] = useState(false);
    const path = place.branch
        ? `collections.${editing.collectionName}.fields.${place.branch.field}.values.${place.branch.option}.${name}`
        : `collections.${editing.collectionName}.fields.${name}`;
    const issues = useIssuesUnder(path);
    const kind = String(field.kind);
    const branchKinds = place.branch ? VALUE_KINDS : FIELD_KINDS;
    const change = (update) => editing.update((collection) => setField(collection, place, name, update));
    const set = (key, value) => change((current) => setProp(current, key, value, FIELD_KEY_ORDER));
    const setBoth = (key, value) => change((current) => {
        const next = setProp(current, key, value, FIELD_KEY_ORDER);
        // A conditional field names its select the same way.
        return current.kind === "conditional" && isObj(next.discriminant)
            ? { ...next, discriminant: setProp(next.discriminant, key, value, FIELD_KEY_ORDER) }
            : next;
    });
    const valueKind = kind !== "view" && kind !== "backlink";
    const label = typeof field.label === "string" ? field.label : "";
    // The title field is a top-level text field: the one with the title role, or the one named `title`.
    const isTitle = !place.branch && titleFieldName(editing.collection) === name;
    return (_jsxs(Collapsible, { open: open, onOpenChange: setOpen, className: "rounded-lg border bg-cms-card", "data-testid": `field-${name}`, children: [_jsxs("div", { className: "flex items-center gap-1 pr-1", children: [_jsxs(CollapsibleTrigger, { "aria-label": t("field.toggle", { name }), className: "group/field flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-cms-ring", children: [_jsx(ChevronRight, { "aria-hidden": true, className: cn("size-4 shrink-0 transition-transform", open && "rotate-90") }), _jsx("code", { className: "shrink-0 font-medium text-sm", children: name }), _jsx("span", { className: "truncate text-cms-muted-foreground text-xs", children: label }), _jsx(Badge, { variant: "secondary", className: "shrink-0", children: t(`kind.${kind}`) }), isTitle && (_jsx(Badge, { variant: "outline", className: "shrink-0", "data-testid": "title-badge", children: t("field.titleBadge") })), field.required === true && (_jsx(Badge, { variant: "outline", className: "shrink-0", children: t("field.requiredBadge") })), issues.length > 0 && (_jsx(Badge, { variant: "destructive", className: "shrink-0", children: t("field.problems", { count: issues.length }) }))] }), _jsx(RowActions, { index: index, count: count, name: name, onMove: (delta) => editing.update((collection) => moveField(collection, place, name, delta)), onRemove: () => editing.update((collection) => removeField(collection, place, name)) })] }), _jsx(CollapsibleContent, { children: _jsxs("div", { className: "flex flex-col gap-3 border-t px-3 py-3", children: [_jsx(IssueList, { issues: issues }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(NameInput, { label: t("field.name"), value: name, taken: allFieldNames(editing.collection).filter((item) => item !== name), hint: t("field.nameHint"), onCommit: (to) => {
                                        editing.update((collection) => renameField(collection, place, name, to));
                                        editing.onRename({ kind: "field", collection: editing.collectionName, from: name, to });
                                    } }), _jsx(Pick, { label: t("field.kind"), value: kind, items: branchKinds.map((item) => ({ value: item, label: t(`kind.${item}`) })), onChange: (next) => change((current) => withKind(current, next, collectionNames)) }), _jsx(TextInput, { label: t("field.label"), value: label, onChange: (value) => setBoth("label", value) }), _jsx(TextInput, { label: t("field.description"), value: field.description, onChange: (value) => setBoth("description", orUndefined(value)) })] }), valueKind && (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [kind === "text" && !place.branch && (_jsx(FlagSwitch, { label: t("field.isTitle"), hint: t("field.isTitleHint"), checked: isTitle, onChange: (on) => on && editing.update((collection) => setTitleField(collection, name)) })), kind !== "conditional" && (_jsx(FlagSwitch, { label: t("field.required"), hint: t("field.requiredHint"), checked: field.required === true, onChange: (on) => set("required", on ? true : undefined) })), LOCALIZED_KINDS.includes(kind) && (_jsx(Pick, { label: t("field.localized"), value: field.localized === true ? "localized" : field.localized === "inherit" ? "inherit" : "shared", items: [
                                        { value: "shared", label: t("field.localizedShared") },
                                        { value: "localized", label: t("field.localizedOwn") },
                                        { value: "inherit", label: t("field.localizedInherit") },
                                    ], onChange: (value) => set("localized", value === "localized" ? true : value === "inherit" ? "inherit" : undefined) }))] })), _jsx(KindOptions, { name: name, field: field, editing: editing, set: set, change: change }), _jsxs("details", { className: "rounded-md border border-dashed px-2.5 py-1.5 text-sm", children: [_jsx("summary", { className: "cursor-pointer text-cms-muted-foreground text-xs", children: t("field.advanced") }), _jsxs("div", { className: "mt-2 grid gap-3 sm:grid-cols-2", children: [_jsx(FlagSwitch, { label: t("field.hidden"), hint: t("field.hiddenHint"), checked: field.hidden === true, onChange: (on) => set("hidden", on ? true : undefined) }), valueKind && (_jsx(TextInput, { label: t("field.role"), hint: t("field.roleHint"), value: field.role, onChange: (value) => set("role", orUndefined(value)) })), _jsx(TextInput, { label: t("field.tab"), hint: t("field.tabHint"), value: field.tab, onChange: (value) => set("tab", orUndefined(value)) }), valueKind && (_jsx(TextInput, { label: t("field.input"), hint: t("field.inputHint"), value: field.input, onChange: (value) => set("input", orUndefined(value)) }))] }), valueKind && (_jsx("div", { className: "mt-3", children: _jsx(InputOptionsEditor, { value: field.inputOptions, onChange: (value) => set("inputOptions", value) }) }))] }), disabled && null] }) })] }));
}
/** The fields of a collection (or of one branch of a conditional field), each editable, with a row to add one. */
export function FieldList({ editing, place, fields, kinds, }) {
    const t = useTranslator(schemaMessages);
    const { collectionNames, disabled } = useSchemaEdit();
    const names = Object.keys(fields);
    const [name, setName] = useState("");
    const [kind, setKind] = useState("text");
    const taken = allFieldNames(editing.collection);
    const problem = name === "" ? "empty" : taken.includes(name) ? "taken" : /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ? null : "pattern";
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [names.length === 0 && _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("field.none") }), names.map((fieldName, index) => (_jsx(FieldEditor, { editing: editing, place: place, name: fieldName, field: fields[fieldName] ?? {}, index: index, count: names.length }, fieldName))), !disabled && (_jsxs("div", { className: "flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-2", children: [_jsx(Labeled, { label: t("field.newName"), className: "min-w-36 flex-1", children: _jsx(Input, { value: name, "aria-label": t("field.newName"), placeholder: "fieldName", "aria-invalid": name !== "" && problem ? true : undefined, onChange: (event) => setName(event.target.value) }) }), _jsx(Pick, { label: t("field.kind"), className: "w-40", value: kind, items: kinds.map((item) => ({ value: item, label: t(`kind.${item}`) })), onChange: (next) => setKind(next) }), _jsx(AddButton, { disabled: Boolean(problem), onClick: () => {
                            if (problem)
                                return;
                            editing.update((collection) => addField(collection, place, name, newField(kind, name.charAt(0).toUpperCase() + name.slice(1), collectionNames)));
                            setName("");
                        }, children: t("field.add") })] }))] }));
}
