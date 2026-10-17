"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fieldTraits, useTranslator } from "@monti-cms/core/site";
import { useRef, useState } from "react";
import { useAdminComponents } from "../../admin-components.js";
import { commonMessages } from "../../lib/common.messages.js";
import { Button } from "../../ui/button.js";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../../ui/sheet.js";
import { LineTabs, Tabs, TabsContent, TabsTrigger } from "../../ui/tabs.js";
import { Labeled } from "../shared/labeled.js";
import { FlagSwitch, IssueList, orUndefined, Pick, Segmented, TextInput, useIssuesUnder, useSchemaEdit, } from "./controls.js";
import { KindOptions, LOCALIZED_KINDS } from "./field-editor.js";
import { FieldCustomInputPicker, FieldRolePicker } from "./field-role-input.js";
import { schemaFieldsMessages } from "./fields.messages.js";
import { FIELD_KEY_ORDER, FIELD_KINDS, fieldAt, isObj, removeBlock, removeField, setField, setProp, setTitleField, titleFieldName, VALUE_KINDS, withKind, } from "./schema-model.js";
/**
 * The editor of one field, in a sheet on the right. Edits go to a copy of the collection: Apply puts the copy into the file, Cancel (or closing the sheet)
 * drops it. Deleting a field is the one thing that acts at once, as a change of the file that the review still shows.
 */
export function FieldSheet({ editing, place, name, onClose, }) {
    const t = useTranslator(schemaFieldsMessages);
    const tc = useTranslator(commonMessages);
    const { disabled, collectionNames } = useSchemaEdit();
    const [draft, setDraft] = useState(editing.collection);
    // Renames of options made in the copy are recorded for the review only when the copy is applied.
    const renames = useRef([]);
    const field = fieldAt(draft, place, name) ?? {};
    const kind = String(field.kind);
    const path = place.branch
        ? `collections.${editing.collectionName}.fields.${place.branch.field}.values.${place.branch.option}.${name}`
        : `collections.${editing.collectionName}.fields.${name}`;
    const issues = useIssuesUnder(path);
    const draftEditing = {
        collectionName: editing.collectionName,
        collection: draft,
        update: (apply) => setDraft((current) => apply(current)),
        onRename: (rename) => {
            renames.current.push(rename);
        },
    };
    const change = (update) => setDraft((current) => setField(current, place, name, update));
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
    const isTitle = !place.branch && titleFieldName(draft) === name;
    const isSlug = !place.branch && (kind === "slug" || name === "slug");
    const isFixed = isTitle || isSlug;
    const { fieldInputs } = useAdminComponents();
    const hasPluginInputs = Object.keys(fieldInputs ?? {}).length > 0;
    const hasCustomInput = typeof field.input === "string" && field.input.length > 0;
    const blocked = removeBlock(editing.collection, place, name);
    const branchKinds = place.branch ? VALUE_KINDS : FIELD_KINDS;
    const apply = () => {
        editing.update(() => draft);
        for (const rename of renames.current)
            editing.onRename(rename);
        onClose();
    };
    const remove = () => {
        editing.update((collection) => removeField(collection, place, name));
        onClose();
    };
    return (_jsx(Sheet, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsxs(SheetContent, { resize: { name: "field-sheet", defaultWidth: 520, minWidth: 420 }, className: "gap-0", "data-testid": "field-sheet", showCloseButton: true, children: [_jsxs(Tabs, { defaultValue: "basic", className: "min-h-0 flex-1 gap-0", children: [_jsxs(SheetHeader, { className: "gap-0 px-6 pt-5 pb-0", children: [_jsx(SheetTitle, { className: "pr-10 font-semibold text-base", children: label || name }), _jsxs(SheetDescription, { className: "text-xs", children: [_jsx("code", { children: name }), " \u00B7 ", t(`kind.${kind}`)] }), _jsxs(LineTabs, { className: "mt-4 h-auto gap-5 rounded-none p-0", children: [_jsx(TabsTrigger, { value: "basic", className: "h-9 flex-none px-0", children: t("sheet.tabBasic") }), _jsx(TabsTrigger, { value: "advanced", className: "h-9 flex-none px-0", children: t("sheet.tabAdvanced") })] })] }), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto px-6 py-6", children: [_jsx(IssueList, { issues: issues }), _jsxs(TabsContent, { value: "basic", className: "flex flex-col gap-8", children: [_jsxs("section", { className: "flex flex-col gap-6", children: [_jsx(TextInput, { label: t("sheet.label"), value: label, onChange: (value) => setBoth("label", value) }), _jsx(TextInput, { label: t("field.description"), optional: true, value: field.description, onChange: (value) => setBoth("description", orUndefined(value)) }), _jsx(Labeled, { label: t("sheet.name"), description: t("sheet.nameHint"), children: _jsx("div", { className: "flex h-9 items-center rounded-md bg-monti-muted px-3 text-sm", children: _jsx("code", { children: name }) }) })] }), _jsxs("section", { className: "flex flex-col gap-5 border-t pt-8", children: [_jsx("h3", { className: "font-semibold text-sm", children: t("sheet.input") }), kind === "text" && !place.branch && (_jsx(FlagSwitch, { label: t("field.isTitle"), description: t("field.isTitleHint"), checked: isTitle, onChange: (on) => on && draftEditing.update((collection) => setTitleField(collection, name)) })), _jsx(KindOptions, { name: name, field: field, editing: draftEditing, set: set, change: change })] }), valueKind && (_jsxs("section", { className: "flex flex-col gap-5 border-t pt-8", children: [_jsx("h3", { className: "font-semibold text-sm", children: t("sheet.rules") }), kind !== "conditional" && (_jsx(FlagSwitch, { label: t("field.required"), description: t("field.requiredHint"), checked: field.required === true, onChange: (on) => set("required", on ? true : undefined) })), LOCALIZED_KINDS.includes(kind) && (_jsx(Segmented, { label: t("field.localized"), value: field.localized === true ? "localized" : field.localized === "inherit" ? "inherit" : "shared", items: [
                                                        { value: "shared", label: t("field.localizedShared") },
                                                        { value: "localized", label: t("field.localizedOwn") },
                                                        { value: "inherit", label: t("field.localizedInherit") },
                                                    ], onChange: (value) => set("localized", value === "localized" ? true : value === "inherit" ? "inherit" : undefined) }))] }))] }), _jsxs(TabsContent, { value: "advanced", className: "flex flex-col gap-6", children: [_jsx(Pick, { label: t("field.kind"), description: isTitle ? t("field.kindFixedTitleHint") : isSlug ? t("field.kindFixedSlugHint") : t("sheet.kindHint"), value: kind, disabled: isFixed, items: branchKinds.map((item) => ({ value: item, label: t(`kind.${item}`) })), onChange: (next) => change((current) => withKind(current, next, collectionNames)) }), !isSlug && valueKind && (_jsx(FieldRolePicker, { role: field.role, kind: kind, isTitle: isTitle, onChange: (role) => set("role", role) })), !isFixed && valueKind && (hasPluginInputs || hasCustomInput) && (_jsx(FieldCustomInputPicker, { value: field.input, options: field.inputOptions, onChangeInput: (input) => set("input", input), onChangeOptions: (opts) => set("inputOptions", opts) }))] })] })] }), _jsxs(SheetFooter, { className: "mt-0 flex-row items-center gap-2 border-t px-6 py-3.5", children: [_jsx(Button, { type: "button", variant: "ghost", size: "sm", disabled: disabled || blocked !== null, title: blocked ? t(`field.removeBlocked.${blocked}`) : undefined, className: "-ml-2.5 text-monti-destructive hover:text-monti-destructive", onClick: remove, children: t("sheet.delete") }), _jsx("div", { className: "flex-1" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: onClose, children: tc("cancel") }), _jsx(Button, { type: "button", size: "sm", disabled: disabled, onClick: apply, children: tc("apply") })] })] }) }));
}
