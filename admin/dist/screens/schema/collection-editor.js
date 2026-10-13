"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui/button.js";
import { Checkbox } from "../../ui/checkbox.js";
import { Label } from "../../ui/label.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs.js";
import { COLLECTION_ICON_NAMES } from "../shared/collection-icon.js";
import { FlagSwitch, IssueList, orUndefined, Pick, TextInput, useIssuesUnder, useSchemaEdit } from "./controls.js";
import { FieldsCard } from "./fields-tree.js";
import { schemaMessages } from "./messages.js";
import { allowedOf, COLLECTION_KEY_ORDER, fieldsOf, hasBody, setProp, withBody, } from "./schema-model.js";
import { Section } from "./section.js";
const HEADINGS = [1, 2, 3, 4, 5, 6];
/** A list the body may be limited to: off allows everything of its kind; on shows a box per name. */
function LimitList({ label, all, value, onChange, nameOf, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const limited = value !== undefined;
    return (_jsxs("fieldset", { className: "flex flex-col gap-3 border-t pt-6 first:border-t-0 first:pt-0", children: [_jsx("legend", { className: "sr-only", children: label }), _jsx(FlagSwitch, { label: t("allowed.limit", { label: label.toLowerCase() }), hint: limited ? undefined : t("allowed.everything"), checked: limited, onChange: (on) => onChange(on ? [...all] : undefined) }), limited && (_jsx("ul", { className: "grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3", children: all.map((item) => {
                    const id = `allowed-${label}-${item}`;
                    return (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Checkbox, { id: id, checked: value.includes(item), disabled: disabled, onCheckedChange: (on) => onChange(on === true
                                    ? all.filter((one) => one === item || value.includes(one))
                                    : value.filter((one) => one !== item)) }), _jsx(Label, { htmlFor: id, title: String(item), className: "font-normal text-sm", children: nameOf ? nameOf(item) : String(item) })] }, String(item)));
                }) }))] }));
}
function BodyEditor({ collection, update }) {
    const t = useTranslator(schemaMessages);
    return (_jsx(Section, { title: t("collection.bodyTitle"), description: t("collection.bodyDescription"), children: _jsx(FlagSwitch, { label: t("collection.body"), hint: t("collection.bodyHint"), checked: hasBody(collection), onChange: (on) => update((current) => withBody(current, on, on ? allowedOf(current) : {})) }) }));
}
/** Which blocks and text styles the body allows: everything unless the writer limits a list. */
function AllowedEditor({ collection, update, }) {
    const t = useTranslator(schemaMessages);
    const site = useSite();
    const { vocabulary } = useSchemaEdit();
    const allowed = allowedOf(collection);
    // Core names have a label in the dictionary; blocks and text styles a plugin adds use the label of their definition.
    const nameLabel = (id) => {
        const key = `allowed.name.${id}`;
        if (key in schemaMessages.messages.en)
            return t(key);
        return site.BLOCK_BY_NAME.get(id)?.label ?? id;
    };
    const limited = Object.values(allowed).some((list) => Array.isArray(list));
    const setAllowed = (key, value) => update((current) => {
        const next = { ...allowedOf(current) };
        if (value === undefined)
            delete next[key];
        else
            next[key] = value;
        return withBody(current, true, next);
    });
    return (_jsxs(Section, { title: t("allowed.title"), description: t("allowed.hint"), note: limited ? t("allowed.note") : undefined, children: [_jsx(LimitList, { label: t("allowed.blocks"), all: vocabulary.blocks, nameOf: nameLabel, value: allowed.blocks, onChange: (value) => setAllowed("blocks", value) }), _jsx(LimitList, { label: t("allowed.marks"), all: vocabulary.marks, nameOf: nameLabel, value: allowed.marks, onChange: (value) => setAllowed("marks", value) }), _jsx(LimitList, { label: t("allowed.headings"), all: HEADINGS, value: allowed.headings, nameOf: (level) => t("allowed.name.heading", { level }), onChange: (value) => setAllowed("headings", value) })] }));
}
export function CollectionEditor({ name, collection, isNew, onChange, onRemove, onRename, }) {
    const t = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const [chosenTab, setTab] = useState("basics");
    // The editor tab only exists for a collection with a body.
    const tab = chosenTab === "editor" && !hasBody(collection) ? "basics" : chosenTab;
    const issues = useIssuesUnder(`collections.${name}`, ".fields");
    const _fields = fieldsOf(collection);
    const set = (key, value) => onChange((current) => setProp(current, key, value, COLLECTION_KEY_ORDER));
    const icon = typeof collection.icon === "string" ? collection.icon : "";
    const icons = [...new Set(["", ...COLLECTION_ICON_NAMES, ...(icon ? [icon] : [])])].map((value) => ({
        value,
        label: value || t("collection.iconDefault"),
    }));
    const editing = { collectionName: name, collection, update: onChange, onRename };
    const label = typeof collection.label === "string" ? collection.label : name;
    const kindLabel = t(collection.kind === "item" ? "collection.kindItem" : "collection.kindDocument");
    const path = typeof collection.path === "string" && collection.path !== "" ? collection.path : null;
    return (_jsxs("div", { className: "flex min-w-0 flex-col gap-6", "data-testid": `collection-${name}`, children: [_jsx(IssueList, { issues: issues }), _jsxs(Tabs, { value: tab, onValueChange: (value) => typeof value === "string" && setTab(value), className: "gap-6", children: [_jsxs("div", { className: "flex flex-col items-start gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("h3", { className: "font-semibold text-lg", children: label }), _jsx("code", { className: "text-cms-muted-foreground text-xs", children: name })] }), _jsx("p", { className: "mt-1 text-cms-muted-foreground text-sm", children: path
                                            ? t("collection.summary", { kind: kindLabel, path })
                                            : t("collection.summaryNoPath", { kind: kindLabel }) }), isNew && _jsx("p", { className: "mt-0.5 text-cms-muted-foreground text-xs", children: t("collection.newHint") })] }), _jsxs(TabsList, { className: "w-fit justify-start", children: [_jsx(TabsTrigger, { value: "basics", children: t("collection.tabs.basics") }), _jsx(TabsTrigger, { value: "fields", children: t("collection.tabs.fields") }), hasBody(collection) && _jsx(TabsTrigger, { value: "editor", children: t("collection.tabs.editor") })] })] }), _jsxs(TabsContent, { value: "basics", className: "flex max-w-[1160px] flex-col gap-12", children: [_jsx(Section, { title: t("collection.basicsTitle"), description: t("collection.basicsDescription"), note: isNew ? undefined : t("collection.nameHint"), children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx(TextInput, { label: t("collection.label"), value: collection.label, onChange: (value) => set("label", value) }), _jsx(Pick, { label: t("collection.kind"), hint: collection.kind === "item" ? t("collection.kindItemHint") : t("collection.kindDocumentHint"), value: String(collection.kind), items: [
                                                { value: "document", label: t("collection.kindDocument") },
                                                { value: "item", label: t("collection.kindItem") },
                                            ], onChange: (value) => set("kind", value) }), _jsx(Pick, { label: t("collection.icon"), value: icon, items: icons, onChange: (value) => set("icon", orUndefined(value)) }), _jsx(TextInput, { label: t("collection.path"), hint: t("collection.pathHint"), placeholder: "/posts/:slug", value: collection.path, onChange: (value) => set("path", orUndefined(value)) })] }) }), _jsx(BodyEditor, { collection: collection, update: onChange }), _jsx(Section, { title: t("collection.dangerTitle"), description: isNew ? t("collection.newHint") : t("collection.dangerDescription"), card: false, children: _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: disabled, className: "border-cms-destructive/50 text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive", onClick: onRemove, children: [_jsx(Trash2, { "aria-hidden": true }), t("collection.remove")] }) }) })] }), _jsx(TabsContent, { value: "fields", className: "flex flex-col gap-12", children: _jsx(FieldsCard, { editing: editing }) }), hasBody(collection) && (_jsx(TabsContent, { value: "editor", className: "flex max-w-[1160px] flex-col gap-12", children: _jsx(AllowedEditor, { collection: collection, update: onChange }) }))] })] }));
}
