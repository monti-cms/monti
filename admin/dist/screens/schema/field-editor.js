"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fieldTraits, OPTION_VALUE_PATTERN, useTranslator } from "@monti-cms/core/site";
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useAdminComponents } from "../../admin-components.js";
import { cn } from "../../lib/utils/cn.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible.js";
import { Input } from "../../ui/input.js";
import { RelationCombobox } from "../entries/relation-combobox.js";
import { Labeled } from "../shared/labeled.js";
import { AddFieldDialog } from "./add-field.js";
import { countOrUndefined, FlagSwitch, IssueList, NameInput, orUndefined, Pick, RowActions, Segmented, TextInput, useIssuesUnder, useSchemaEdit, } from "./controls.js";
import { FieldCustomInputPicker, FieldRolePicker } from "./field-role-input.js";
import { schemaFieldsMessages } from "./fields.messages.js";
import { ADDABLE_KINDS, addOption, allFieldNames, collectionLabel, FIELD_KEY_ORDER, fieldsOf, hasBody, isObj, moveField, moveOption, optionsOf, removeBlock, removeField, removeOption, renameField, renameOption, setDefaultOption, setField, setOptionLabel, setProp, setTitleField, titleFieldName, unpublishedTargetsOf, withKind, withOptionFields, withUnpublishedTargets, } from "./schema-model.js";
/** The kinds a field can be switched to in its editor: the ones offered for a new field, and the kind it has now. */
export const kindChoices = (kind) => ADDABLE_KINDS.includes(kind) ? ADDABLE_KINDS : [...ADDABLE_KINDS, kind];
/** A few names that stand for the target's entries in the preview of a relation input. */
const previewOptions = (label) => [1, 2, 3].map((number) => ({ value: `preview-${number}`, label: `${label} ${number}` }));
/**
 * The settings of a relation: what it links to and how many, the input as the entry editor will draw it, and the rest under "More". The preview is the real input
 * with stand-in entries, so a setting shows what it does instead of being described.
 */
function RelationOptions({ field, set, change, opposite, more, }) {
    const t = useTranslator(schemaFieldsMessages);
    const { collectionNames, file } = useSchemaEdit();
    const target = typeof field.to === "string" ? field.to : "";
    const many = field.many === true;
    // Entries made with "Add" in the preview, on top of the stand-ins; they go when the target changes.
    const [created, setCreated] = useState([]);
    const [value, setValue] = useState([]);
    const options = [...previewOptions(collectionLabel(file, target)), ...created];
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(Pick, { label: t("field.relationTo"), value: target, items: collectionNames.map((name) => ({ value: name, label: collectionLabel(file, name) })), onChange: (next) => {
                    set("to", next);
                    setCreated([]);
                    setValue([]);
                } }), _jsx(Segmented, { label: t("field.count"), value: many ? "many" : "one", items: [
                    { value: "one", label: t("field.one") },
                    { value: "many", label: t("field.many") },
                ], onChange: (next) => {
                    set("many", next === "many" ? true : undefined);
                    setValue((current) => (next === "many" ? current : current.slice(0, 1)));
                } }), _jsxs("div", { className: "flex flex-col gap-2 rounded-md bg-monti-muted/60 p-3", "data-testid": "relation-preview", children: [_jsx("span", { className: "text-monti-muted-foreground text-xs", children: t("field.preview") }), _jsx("span", { className: "font-medium text-sm", children: typeof field.label === "string" ? field.label : "" }), _jsx(RelationCombobox, { "aria-label": t("field.preview"), options: options, multiple: many, value: value, onValueChange: setValue, placeholder: typeof field.placeholder === "string" ? field.placeholder : undefined, onCreate: field.createInline === true
                            ? async (label) => {
                                const option = { value: `preview-${label}`, label };
                                setCreated((current) => [...current, option]);
                                return option.value;
                            }
                            : undefined }, `${target}-${many}`)] }), _jsxs(Collapsible, { className: "flex flex-col gap-5", children: [_jsxs(CollapsibleTrigger, { className: "group/more flex w-fit items-center gap-1 text-monti-muted-foreground text-sm outline-none hover:text-monti-foreground focus-visible:ring-2 focus-visible:ring-monti-ring", children: [_jsx(ChevronRight, { "aria-hidden": true, className: "size-4 transition-transform group-data-[panel-open]/more:rotate-90" }), t("field.more")] }), _jsxs(CollapsibleContent, { className: "flex flex-col gap-5", children: [_jsx(FlagSwitch, { label: t("field.createInline"), checked: field.createInline === true, onChange: (on) => set("createInline", on ? true : undefined) }), many && opposite && (_jsx(FlagSwitch, { label: t("field.opposite"), checked: opposite.on, onChange: opposite.onChange })), _jsx(Pick, { label: t("field.unpublished"), value: unpublishedTargetsOf(field), items: ["hidden", "blocking", "allowed"].map((choice) => ({
                                    value: choice,
                                    label: t(`field.unpublished.${choice}`),
                                })), onChange: (choice) => change((current) => withUnpublishedTargets(current, choice)) }), _jsx(TextInput, { label: t("field.placeholder"), value: field.placeholder, onChange: (text) => set("placeholder", orUndefined(text)) }), more] })] })] }));
}
/** The options of a select (or of the select a conditional field shows): value, label, default, order. */
function OptionsEditor({ field, fieldName, editing, change, }) {
    const t = useTranslator(schemaFieldsMessages);
    const { disabled } = useSchemaEdit();
    const options = optionsOf(field);
    const values = Object.keys(options);
    const select = field.kind === "conditional" && isObj(field.discriminant) ? field.discriminant : field;
    const [draftValue, setDraftValue] = useState("");
    const taken = (value) => values.filter((item) => item !== value);
    const addable = draftValue !== "" && OPTION_VALUE_PATTERN.test(draftValue) && !values.includes(draftValue);
    return (_jsxs("fieldset", { className: "flex flex-col gap-1.5", children: [_jsx("legend", { className: "font-medium text-xs", children: t("options.title") }), _jsx("ul", { className: "flex flex-col gap-1.5", children: values.map((value, index) => (_jsxs("li", { className: "flex flex-wrap items-end gap-2 rounded-md border bg-monti-background p-2", children: [_jsx(NameInput, { label: t("options.value"), value: value, taken: taken(value), className: "w-32 flex-none", onCommit: (to) => {
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
/** What the kind of the field adds: its own options. */
export function KindOptions({ name, field, editing, set, change, place = {}, opposite, more, }) {
    const t = useTranslator(schemaFieldsMessages);
    const { collectionNames, file } = useSchemaEdit();
    const optionFields = !place.branch && (_jsx(FlagSwitch, { label: t("field.optionFields"), checked: field.kind === "conditional", onChange: (on) => change((current) => withOptionFields(current, on)) }));
    const placeholder = (_jsx(TextInput, { label: t("field.placeholder"), value: field.placeholder, onChange: (value) => set("placeholder", orUndefined(value)) }));
    const collections = collectionNames.map((value) => ({ value, label: value }));
    switch (field.kind) {
        case "text": {
            const fill = field.fillFromBody;
            return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(FlagSwitch, { label: t("field.multiline"), checked: field.multiline === true, onChange: (on) => set("multiline", on ? true : undefined) }), field.multiline === true && (_jsx(TextInput, { label: t("field.rows"), type: "number", value: field.rows, onChange: (value) => set("rows", countOrUndefined(value)) })), _jsx(TextInput, { label: t("field.max"), type: "number", value: field.max, onChange: (value) => set("max", countOrUndefined(value)) }), hasBody(editing.collection) && (_jsxs(_Fragment, { children: [_jsx(FlagSwitch, { label: t("field.fillFromBody"), description: t("field.fillFromBodyHint"), checked: Boolean(fill), onChange: (on) => set("fillFromBody", on ? true : undefined) }), Boolean(fill) && (_jsx(TextInput, { label: t("field.fillLength"), type: "number", value: isObj(fill) ? fill.maxLength : undefined, placeholder: "160", onChange: (value) => {
                                    const maxLength = countOrUndefined(value);
                                    set("fillFromBody", maxLength === undefined ? true : { maxLength });
                                } }))] })), placeholder] }));
        }
        case "slug": {
            const texts = Object.entries(fieldsOf(editing.collection))
                .filter(([, item]) => item.kind === "text")
                .map(([key]) => ({ value: key, label: key }));
            return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(Pick, { label: t("field.slugFrom"), description: t("field.slugFromHint"), value: typeof field.from === "string" ? field.from : "", items: [{ value: "", label: t("none") }, ...texts], onChange: (value) => set("from", orUndefined(value)) }), placeholder] }));
        }
        case "relation":
            return _jsx(RelationOptions, { field: field, set: set, change: change, opposite: opposite, more: more });
        case "select":
            return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(OptionsEditor, { field: field, fieldName: name, editing: editing, change: change }), optionFields] }));
        case "media":
            return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(Pick, { label: t("field.accept"), value: field.accept ?? "image", items: [
                            { value: "image", label: t("field.acceptImage") },
                            { value: "file", label: t("field.acceptFile") },
                        ], onChange: (value) => set("accept", value === "image" ? undefined : value) }), placeholder] }));
        case "backlink": {
            const from = typeof field.from === "string" ? field.from : "";
            const target = isObj(file.collections) ? file.collections[from] : undefined;
            const relations = Object.entries(target ? fieldsOf(target) : {})
                .filter(([, item]) => item.kind === "relation" && item.many === true)
                .map(([key]) => ({ value: key, label: key }));
            return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(Pick, { label: t("field.backlinkFrom"), value: from, items: collections, onChange: (value) => set("from", value) }), _jsx(Pick, { label: t("field.backlinkVia"), description: t("field.backlinkViaHint"), value: typeof field.via === "string" ? field.via : "", items: relations, onChange: (value) => set("via", value) }), _jsx(FlagSwitch, { label: t("field.createInline"), checked: field.createInline === true, onChange: (on) => set("createInline", on ? true : undefined) }), placeholder] }));
        }
        case "view":
            return (_jsx(TextInput, { label: t("field.view"), description: t("field.viewHint"), value: field.view, onChange: (value) => set("view", value) }));
        case "conditional": {
            const options = optionsOf(field);
            const values = isObj(field.values) ? field.values : {};
            return (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx(OptionsEditor, { field: field, fieldName: name, editing: editing, change: change }), optionFields, _jsx("div", { className: "flex flex-col gap-2", children: Object.keys(options).map((option) => (_jsxs("div", { className: "flex flex-col gap-2 rounded-md border border-dashed p-2", children: [_jsx("span", { className: "font-medium text-xs", children: t("field.whenOption", { option: options[option] ?? option }) }), _jsx(FieldList, { editing: editing, place: { branch: { field: name, option } }, fields: values[option] ?? {} })] }, option))) })] }));
        }
        default:
            return null;
    }
}
export const LOCALIZED_KINDS = ["text", "slug", "relation", "select", "media", "conditional"];
export function FieldEditor({ editing, place, name, field, index, count, }) {
    const t = useTranslator(schemaFieldsMessages);
    const { disabled, collectionNames } = useSchemaEdit();
    const [open, setOpen] = useState(false);
    const path = place.branch
        ? `collections.${editing.collectionName}.fields.${place.branch.field}.values.${place.branch.option}.${name}`
        : `collections.${editing.collectionName}.fields.${name}`;
    const issues = useIssuesUnder(path);
    const kind = String(field.kind);
    const change = (update) => editing.update((collection) => setField(collection, place, name, update));
    const set = (key, value) => change((current) => setProp(current, key, value, FIELD_KEY_ORDER));
    const setBoth = (key, value) => change((current) => {
        const next = setProp(current, key, value, FIELD_KEY_ORDER);
        // A conditional field names its select the same way.
        return current.kind === "conditional" && isObj(next.discriminant)
            ? { ...next, discriminant: setProp(next.discriminant, key, value, FIELD_KEY_ORDER) }
            : next;
    });
    const valueKind = fieldTraits[kind].entersValue;
    const label = typeof field.label === "string" ? field.label : "";
    // The title field is a top-level text field: the one with the title role, or the one named `title`.
    const isTitle = !place.branch && titleFieldName(editing.collection) === name;
    const isSlug = !place.branch && (kind === "slug" || name === "slug");
    const isFixed = isTitle || isSlug;
    const { fieldInputs } = useAdminComponents();
    const hasPluginInputs = Object.keys(fieldInputs ?? {}).length > 0;
    const hasCustomInput = typeof field.input === "string" && field.input.length > 0;
    const blocked = removeBlock(editing.collection, place, name);
    return (_jsxs(Collapsible, { open: open, onOpenChange: setOpen, className: "rounded-lg border bg-monti-card", "data-testid": `field-${name}`, children: [_jsxs("div", { className: "flex items-center gap-1 pr-1", children: [_jsxs(CollapsibleTrigger, { "aria-label": t("field.toggle", { name }), className: "group/field flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-monti-ring", children: [_jsx(ChevronRight, { "aria-hidden": true, className: cn("size-4 shrink-0 transition-transform", open && "rotate-90") }), _jsx("code", { className: "shrink-0 font-medium text-sm", children: name }), _jsx("span", { className: "truncate text-monti-muted-foreground text-xs", children: label }), _jsx(Badge, { variant: "secondary", className: "shrink-0", children: t(`kind.${kind}`) }), isTitle && (_jsx(Badge, { variant: "outline", className: "shrink-0", "data-testid": "title-badge", children: t("field.titleBadge") })), field.required === true && (_jsx(Badge, { variant: "outline", className: "shrink-0", children: t("field.requiredBadge") })), issues.length > 0 && (_jsx(Badge, { variant: "destructive", className: "shrink-0", children: t("field.problems", { count: issues.length }) }))] }), _jsx(RowActions, { index: index, count: count, name: name, onMove: (delta) => editing.update((collection) => moveField(collection, place, name, delta)), onRemove: () => editing.update((collection) => removeField(collection, place, name)), removeBlocked: blocked ? t(`field.removeBlocked.${blocked}`) : undefined })] }), _jsx(CollapsibleContent, { children: _jsxs("div", { className: "flex flex-col gap-3 border-t px-3 py-3", children: [_jsx(IssueList, { issues: issues }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(NameInput, { label: t("field.name"), value: name, taken: allFieldNames(editing.collection).filter((item) => item !== name), description: t("field.nameHint"), onCommit: (to) => {
                                        editing.update((collection) => renameField(collection, place, name, to));
                                        editing.onRename({ kind: "field", collection: editing.collectionName, from: name, to });
                                    } }), _jsx(Pick, { label: t("field.kind"), description: isTitle ? t("field.kindFixedTitleHint") : isSlug ? t("field.kindFixedSlugHint") : undefined, value: kind, disabled: isFixed, items: kindChoices(kind).map((item) => ({ value: item, label: t(`kind.${item}`) })), onChange: (next) => change((current) => withKind(current, next, collectionNames)) }), _jsx(TextInput, { label: t("field.label"), value: label, onChange: (value) => setBoth("label", value) }), _jsx(TextInput, { label: t("field.description"), value: field.description, onChange: (value) => setBoth("description", orUndefined(value)) })] }), valueKind && (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [kind === "text" && !place.branch && (_jsx(FlagSwitch, { label: t("field.isTitle"), description: isTitle ? t("field.isTitleFixedHint") : t("field.isTitleHint"), checked: isTitle, locked: isTitle, onChange: (on) => on && editing.update((collection) => setTitleField(collection, name)) })), kind !== "conditional" && (_jsx(FlagSwitch, { label: t("field.required"), description: isTitle ? t("field.requiredTitleHint") : t("field.requiredHint"), checked: isTitle || field.required === true, locked: isTitle, onChange: (on) => set("required", on ? true : undefined) })), LOCALIZED_KINDS.includes(kind) && (_jsx(Pick, { label: t("field.localized"), value: field.localized === true ? "localized" : field.localized === "inherit" ? "inherit" : "shared", items: [
                                        { value: "shared", label: t("field.localizedShared") },
                                        { value: "localized", label: t("field.localizedOwn") },
                                        { value: "inherit", label: t("field.localizedInherit") },
                                    ], onChange: (value) => set("localized", value === "localized" ? true : value === "inherit" ? "inherit" : undefined) }))] })), _jsx(KindOptions, { name: name, field: field, editing: editing, set: set, change: change, place: place }), _jsxs("details", { className: "rounded-md border border-dashed px-2.5 py-1.5 text-sm", children: [_jsx("summary", { className: "cursor-pointer text-monti-muted-foreground text-xs", children: t("field.advanced") }), _jsxs("div", { className: "mt-3 flex flex-col gap-4", children: [!isSlug && valueKind && (_jsx(FieldRolePicker, { role: field.role, kind: kind, isTitle: isTitle, onChange: (role) => set("role", role) })), !isFixed && valueKind && (hasPluginInputs || hasCustomInput) && (_jsx(FieldCustomInputPicker, { value: field.input, options: field.inputOptions, onChangeInput: (input) => set("input", input), onChangeOptions: (opts) => set("inputOptions", opts) }))] })] }), disabled && null] }) })] }));
}
/** The fields of one branch of a conditional field, each editable, with a button that adds one. */
export function FieldList({ editing, place, fields, }) {
    const t = useTranslator(schemaFieldsMessages);
    const { disabled } = useSchemaEdit();
    const names = Object.keys(fields);
    const [adding, setAdding] = useState(false);
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [names.length === 0 && _jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("field.none") }), names.map((fieldName, index) => (_jsx(FieldEditor, { editing: editing, place: place, name: fieldName, field: fields[fieldName] ?? {}, index: index, count: names.length }, fieldName))), !disabled && (_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "w-fit", onClick: () => setAdding(true), children: [_jsx(Plus, { "aria-hidden": true }), t("field.add")] })), adding && (_jsx(AddFieldDialog, { editing: editing, place: place, onClose: () => setAdding(false), onAdded: () => setAdding(false) }))] }));
}
