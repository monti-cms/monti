"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { Trash2 } from "lucide-react";
import { useId } from "react";
import { editorMessages } from "../../editor/messages.js";
import { Button } from "../../ui/button.js";
import { Checkbox } from "../../ui/checkbox.js";
import { Label } from "../../ui/label.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs.js";
import { Section } from "../shared/section.js";
import { schemaCollectionMessages } from "./collection.messages.js";
import { FlagSwitch, IssueList, orUndefined, Pick, TextInput, useIssuesUnder, useSchemaEdit } from "./controls.js";
import { FieldsCard } from "./fields-tree.js";
import { IconPicker } from "./icon-picker.js";
import { schemaMessages } from "./messages.js";
import { PublicPathField } from "./public-path-field.js";
import { allowedOf, COLLECTION_KEY_ORDER, defaultPath, fieldsOf, hasBody, setProp, withBody, } from "./schema-model.js";
const HEADINGS = [1, 2, 3, 4, 5, 6];
/** The editor dictionary key that names each core block and text style in the allowed-blocks picker. */
const EDITOR_NAME = {
    table: "toolbar.table",
    taskList: "toolbar.todo",
    math: "block.math",
    image: "toolbar.image",
    file: "toolbar.file",
    codeBlock: "toolbar.codeBlock",
    blockquote: "toolbar.quote",
    horizontalRule: "toolbar.divider",
    footnotes: "block.footnotes",
    "text-align": "block.text-align",
    bold: "inlineMarks.bold",
    italic: "inlineMarks.italic",
    strike: "inlineMarks.strike",
    underline: "inlineMarks.underline",
    code: "block.code",
    link: "toolbar.link",
    superscript: "inlineMarks.superscript",
    subscript: "inlineMarks.subscript",
};
/** A list the body may be limited to: "Allow all" checkbox allows everything; below are checkboxes per item, always visible. */
function LimitList({ label, all, value, onChange, nameOf, }) {
    const t = useTranslator(schemaCollectionMessages);
    const { disabled } = useSchemaEdit();
    const allId = useId();
    const allowedCount = value === undefined ? all.length : all.filter((item) => value.includes(item)).length;
    const allAllowed = allowedCount === all.length;
    const someAllowed = allowedCount > 0 && !allAllowed;
    return (_jsxs("fieldset", { className: "flex flex-col gap-3 border-t pt-6 first:border-t-0 first:pt-0", children: [_jsx("legend", { className: "sr-only", children: label }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium text-sm", children: label }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Checkbox, { id: allId, checked: allAllowed, indeterminate: someAllowed, disabled: disabled, onCheckedChange: (on) => onChange(on === true ? undefined : []) }), _jsx(Label, { htmlFor: allId, className: "cursor-pointer font-normal text-cms-muted-foreground text-sm", children: t("allowed.all") })] })] }), _jsx("ul", { className: "grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3", children: all.map((item) => {
                    const id = `allowed-${label}-${item}`;
                    const checked = value === undefined || value.includes(item);
                    return (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Checkbox, { id: id, checked: checked, disabled: disabled, onCheckedChange: (on) => {
                                    const currentList = value === undefined ? [...all] : value;
                                    const nextList = on === true
                                        ? all.filter((one) => one === item || currentList.includes(one))
                                        : currentList.filter((one) => one !== item);
                                    onChange(nextList.length === all.length ? undefined : nextList);
                                } }), _jsx(Label, { htmlFor: id, title: String(item), className: "font-normal text-sm", children: nameOf ? nameOf(item) : String(item) })] }, String(item)));
                }) })] }));
}
/** Which blocks and text styles the body allows: everything unless the writer limits a list. */
function AllowedEditor({ collection, update, }) {
    const t = useTranslator(schemaCollectionMessages);
    const te = useTranslator(editorMessages);
    const site = useSite();
    const { vocabulary } = useSchemaEdit();
    const allowed = allowedOf(collection);
    // Core blocks and text styles are named by the editor's dictionary; ones a plugin adds use the label of their definition.
    const nameLabel = (id) => {
        const key = EDITOR_NAME[id];
        if (key)
            return te(key);
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
    return (_jsxs(Section, { title: t("allowed.title"), description: t("allowed.hint"), note: limited ? t("allowed.note") : undefined, children: [_jsx(LimitList, { label: t("allowed.headings"), all: HEADINGS, value: allowed.headings, nameOf: (level) => te("toolbar.heading", { level }), onChange: (value) => setAllowed("headings", value) }), _jsx(LimitList, { label: t("allowed.marks"), all: vocabulary.marks, nameOf: nameLabel, value: allowed.marks, onChange: (value) => setAllowed("marks", value) }), _jsx(LimitList, { label: t("allowed.blocks"), all: vocabulary.blocks, nameOf: nameLabel, value: allowed.blocks, onChange: (value) => setAllowed("blocks", value) })] }));
}
export function CollectionEditor({ name, section, onSection, collection, isNew, onChange, onRemove, onRename, }) {
    const t = useTranslator(schemaCollectionMessages);
    const ts = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const chosenTab = section ?? "basics";
    const isEditorAvailable = collection.kind !== "item" && hasBody(collection);
    // The editor tab only exists for a document collection with a body.
    const tab = chosenTab === "editor" && !isEditorAvailable ? "basics" : chosenTab;
    const issues = useIssuesUnder(`collections.${name}`, ".fields");
    const _fields = fieldsOf(collection);
    const set = (key, value) => onChange((current) => setProp(current, key, value, COLLECTION_KEY_ORDER));
    const editing = { collectionName: name, collection, update: onChange, onRename };
    const label = typeof collection.label === "string" ? collection.label : name;
    const kindLabel = ts(collection.kind === "item" ? "collection.kindItem" : "collection.kindDocument");
    const path = typeof collection.path === "string" && collection.path !== "" ? collection.path : null;
    return (_jsxs("div", { className: "flex min-w-0 flex-col gap-6", "data-testid": `collection-${name}`, children: [_jsx(IssueList, { issues: issues }), _jsxs(Tabs, { value: tab, onValueChange: (value) => typeof value === "string" && onSection(value), className: "gap-6", children: [_jsxs("div", { className: "flex flex-col items-start gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("h3", { className: "font-semibold text-lg", children: label }), _jsx("code", { className: "text-cms-muted-foreground text-xs", children: name })] }), _jsx("p", { className: "mt-1 text-cms-muted-foreground text-sm", children: path
                                            ? t("collection.summary", { kind: kindLabel, path })
                                            : t("collection.summaryNoPath", { kind: kindLabel }) }), isNew && _jsx("p", { className: "mt-0.5 text-cms-muted-foreground text-xs", children: t("collection.newHint") })] }), _jsxs(TabsList, { className: "w-fit justify-start", children: [_jsx(TabsTrigger, { value: "basics", children: t("collection.tabs.basics") }), _jsx(TabsTrigger, { value: "fields", children: t("collection.tabs.fields") }), isEditorAvailable && _jsx(TabsTrigger, { value: "editor", children: t("collection.tabs.editor") })] })] }), _jsxs(TabsContent, { value: "basics", className: "flex max-w-[1160px] flex-col gap-12", children: [_jsx(Section, { title: t("collection.basicsTitle"), description: t("collection.basicsDescription"), note: isNew ? undefined : t("collection.nameHint"), children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx(TextInput, { label: t("collection.label"), value: collection.label, onChange: (value) => set("label", value) }), _jsx(Pick, { label: t("collection.kind"), description: collection.kind === "item" ? t("collection.kindItemHint") : t("collection.kindDocumentHint"), value: String(collection.kind), items: [
                                                { value: "document", label: ts("collection.kindDocument") },
                                                { value: "item", label: ts("collection.kindItem") },
                                            ], onChange: (value) => {
                                                onChange((current) => {
                                                    let next = setProp(current, "kind", value, COLLECTION_KEY_ORDER);
                                                    if (value === "item" && hasBody(next)) {
                                                        next = withBody(next, false, {});
                                                    }
                                                    else if (value === "document" && !hasBody(next)) {
                                                        next = withBody(next, true, {});
                                                    }
                                                    return next;
                                                });
                                            } }), _jsx(IconPicker, { label: t("collection.icon"), value: typeof collection.icon === "string" ? collection.icon : undefined, kind: typeof collection.kind === "string" ? collection.kind : undefined, onChange: (value) => set("icon", value) })] }) }), _jsx(Section, { title: t("collection.featuresTitle"), description: t("collection.featuresDescription"), children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx(FlagSwitch, { label: t("collection.folders"), description: t("collection.foldersHint"), checked: typeof collection.folders === "boolean" ? collection.folders : collection.kind !== "item", onChange: (on) => {
                                                const isDefault = on === (collection.kind !== "item");
                                                set("folders", isDefault ? undefined : on);
                                            } }), _jsx(PublicPathField, { path: typeof collection.path === "string" ? collection.path : "", suggested: defaultPath(name), onChange: (value) => set("path", orUndefined(value)) })] }) }), _jsx(Section, { title: t("collection.dangerTitle"), description: isNew ? t("collection.newHint") : t("collection.dangerDescription"), card: false, children: _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: disabled, className: "border-cms-destructive/50 text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive", onClick: onRemove, children: [_jsx(Trash2, { "aria-hidden": true }), ts("collection.remove")] }) }) })] }), _jsx(TabsContent, { value: "fields", className: "flex flex-col gap-12", children: _jsx(FieldsCard, { editing: editing }) }), isEditorAvailable && (_jsx(TabsContent, { value: "editor", className: "flex max-w-[1160px] flex-col gap-12", children: _jsx(AllowedEditor, { collection: collection, update: onChange }) }))] })] }));
}
