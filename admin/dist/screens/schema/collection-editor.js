"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { Trash2 } from "lucide-react";
import { Button } from "../../ui/button.js";
import { Checkbox } from "../../ui/checkbox.js";
import { Label } from "../../ui/label.js";
import { COLLECTION_ICON_NAMES } from "../shared/collection-icon.js";
import { AddButton, FlagSwitch, IssueList, OrderedNames, orUndefined, Pick, RowActions, TextInput, useIssuesUnder, useSchemaEdit, } from "./controls.js";
import { FieldList } from "./field-editor.js";
import { schemaMessages } from "./messages.js";
import { allowedOf, COLLECTION_KEY_ORDER, columnsOf, FIELD_KINDS, fieldsOf, hasBody, layoutOf, moveItem, SYSTEM_COLUMNS, setProp, storedFieldNames, titleFieldName, withBody, withColumns, withLayout, } from "./schema-model.js";
const HEADINGS = [1, 2, 3, 4, 5, 6];
/** A list the body may be limited to: off allows everything of its kind; on shows a box per name. */
function LimitList({ label, all, value, onChange, nameOf, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const limited = value !== undefined;
    return (_jsxs("fieldset", { className: "flex flex-col gap-2 rounded-md border p-2.5", children: [_jsx("legend", { className: "px-1 font-medium text-xs", children: label }), _jsx(FlagSwitch, { label: t("allowed.limit", { label: label.toLowerCase() }), hint: limited ? undefined : t("allowed.everything"), checked: limited, onChange: (on) => onChange(on ? [...all] : undefined) }), limited && (_jsx("ul", { className: "grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3", children: all.map((item) => {
                    const id = `allowed-${label}-${item}`;
                    return (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Checkbox, { id: id, checked: value.includes(item), disabled: disabled, onCheckedChange: (on) => onChange(on === true
                                    ? all.filter((one) => one === item || value.includes(one))
                                    : value.filter((one) => one !== item)) }), _jsx(Label, { htmlFor: id, className: "font-normal text-sm", children: nameOf ? nameOf(item) : String(item) })] }, String(item)));
                }) }))] }));
}
function BodyEditor({ collection, update }) {
    const t = useTranslator(schemaMessages);
    const { vocabulary } = useSchemaEdit();
    const enabled = hasBody(collection);
    const allowed = allowedOf(collection);
    const setAllowed = (key, value) => update((current) => {
        const next = { ...allowedOf(current) };
        if (value === undefined)
            delete next[key];
        else
            next[key] = value;
        return withBody(current, true, next);
    });
    return (_jsxs("section", { className: "flex flex-col gap-3", children: [_jsx(FlagSwitch, { label: t("collection.body"), hint: t("collection.bodyHint"), checked: enabled, onChange: (on) => update((current) => withBody(current, on, on ? allowedOf(current) : {})) }), enabled && (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("h4", { className: "font-medium text-sm", children: t("allowed.title") }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("allowed.hint") }), _jsx(LimitList, { label: t("allowed.blocks"), all: vocabulary.blocks, value: allowed.blocks, onChange: (value) => setAllowed("blocks", value) }), _jsx(LimitList, { label: t("allowed.marks"), all: vocabulary.marks, value: allowed.marks, onChange: (value) => setAllowed("marks", value) }), _jsx(LimitList, { label: t("allowed.headings"), all: HEADINGS, value: allowed.headings, nameOf: (level) => `H${level}`, onChange: (value) => setAllowed("headings", value) })] }))] }));
}
function LayoutEditor({ collection, update }) {
    const t = useTranslator(schemaMessages);
    const groups = layoutOf(collection);
    const names = storedFieldNames(collection).concat(Object.entries(fieldsOf(collection))
        .filter(([, field]) => field.kind === "view" || field.kind === "backlink")
        .map(([name]) => name));
    const change = (next) => update((current) => withLayout(current, next));
    const edit = (index, patch) => change(groups.map((group, at) => {
        if (at !== index)
            return group;
        const merged = { ...group, ...patch };
        for (const key of Object.keys(merged))
            if (merged[key] === undefined)
                delete merged[key];
        return merged;
    }));
    return (_jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("layout.hint") }), groups.map((group, index) => (_jsxs("div", { className: "flex flex-col gap-2 rounded-lg border p-2.5", children: [_jsxs("div", { className: "flex items-end gap-2", children: [_jsx(TextInput, { label: t("layout.group"), value: group.group, className: "min-w-0 flex-1", onChange: (value) => edit(index, { group: orUndefined(value) }) }), _jsx(TextInput, { label: t("layout.tab"), value: group.tab, className: "w-32", onChange: (value) => edit(index, { tab: orUndefined(value) }) }), _jsx(RowActions, { index: index, count: groups.length, name: group.group ?? t("layout.untitled"), onMove: (delta) => change(moveItem(groups, index, delta)), onRemove: () => change(groups.filter((_, at) => at !== index)) })] }), _jsx(FlagSwitch, { label: t("layout.collapsed"), checked: group.collapsed === true, onChange: (on) => edit(index, { collapsed: on ? true : undefined }) }), _jsx(OrderedNames, { label: t("layout.fields"), names: group.fields, options: names, onChange: (next) => edit(index, { fields: next }) })] }, `${group.group ?? ""}-${index}`))), _jsx("div", { children: _jsx(AddButton, { onClick: () => change([...groups, { fields: [] }]), children: t("layout.add") }) })] }));
}
function ListEditor({ collection, update }) {
    const t = useTranslator(schemaMessages);
    const columns = columnsOf(collection);
    const slugs = Object.entries(fieldsOf(collection))
        .filter(([, field]) => field.kind === "slug")
        .map(([name]) => name);
    const options = [...storedFieldNames(collection), ...slugs, ...(slugs.length > 0 ? ["slug"] : []), ...SYSTEM_COLUMNS];
    return (_jsxs("section", { className: "flex flex-col gap-2", children: [_jsx(FlagSwitch, { label: t("list.custom"), hint: columns ? undefined : t("list.default"), checked: columns !== undefined, onChange: (on) => update((current) => withColumns(current, on ? [titleFieldName(current)].filter((name) => name !== undefined) : undefined)) }), columns && (_jsx(OrderedNames, { label: t("list.columns"), names: columns, options: [...new Set(options)], onChange: (next) => update((current) => withColumns(current, next)) }))] }));
}
export function CollectionEditor({ name, collection, isNew, onChange, onRemove, onRename, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const issues = useIssuesUnder(`collections.${name}`, ".fields");
    const fields = fieldsOf(collection);
    const set = (key, value) => onChange((current) => setProp(current, key, value, COLLECTION_KEY_ORDER));
    const icon = typeof collection.icon === "string" ? collection.icon : "";
    const icons = [...new Set(["", ...COLLECTION_ICON_NAMES, ...(icon ? [icon] : [])])].map((value) => ({
        value,
        label: value || t("collection.iconDefault"),
    }));
    const editing = { collectionName: name, collection, update: onChange, onRename };
    return (_jsxs("div", { className: "flex min-w-0 flex-col gap-5", "data-testid": `collection-${name}`, children: [_jsx(IssueList, { issues: issues }), _jsxs("section", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("h3", { className: "font-semibold text-base", children: [typeof collection.label === "string" ? collection.label : name, " ", _jsx("code", { className: "font-normal text-cms-muted-foreground text-xs", children: name })] }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: isNew ? t("collection.newHint") : t("collection.nameHint") })] }), _jsxs(Button, { type: "button", variant: "destructive", size: "sm", disabled: disabled, onClick: onRemove, children: [_jsx(Trash2, { "aria-hidden": true }), t("collection.remove")] })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(TextInput, { label: t("collection.label"), value: collection.label, onChange: (value) => set("label", value) }), _jsx(Pick, { label: t("collection.kind"), hint: collection.kind === "item" ? t("collection.kindItemHint") : t("collection.kindDocumentHint"), value: String(collection.kind), items: [
                                    { value: "document", label: t("collection.kindDocument") },
                                    { value: "item", label: t("collection.kindItem") },
                                ], onChange: (value) => set("kind", value) }), _jsx(Pick, { label: t("collection.icon"), value: icon, items: icons, onChange: (value) => set("icon", orUndefined(value)) }), _jsx(TextInput, { label: t("collection.path"), hint: t("collection.pathHint"), placeholder: "/posts/:slug", value: collection.path, onChange: (value) => set("path", orUndefined(value)) })] })] }), _jsx(BodyEditor, { collection: collection, update: onChange }), _jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("h4", { className: "font-medium text-sm", children: t("field.title") }), _jsx(FieldList, { editing: editing, place: {}, fields: fields, kinds: FIELD_KINDS })] }), _jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("h4", { className: "font-medium text-sm", children: t("layout.title") }), _jsx(LayoutEditor, { collection: collection, update: onChange })] }), _jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("h4", { className: "font-medium text-sm", children: t("list.title") }), _jsx(ListEditor, { collection: collection, update: onChange })] })] }));
}
