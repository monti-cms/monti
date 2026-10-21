"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { Image, Link2, ListChecks, Type } from "lucide-react";
import { useState } from "react";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { DialogFormFooter } from "../../ui/dialog-form-footer.js";
import { Input } from "../../ui/input.js";
import { Labeled } from "../shared/labeled.js";
import { TextInput, useSchemaEdit } from "./controls.js";
import { KindOptions } from "./field-editor.js";
import { schemaFieldsMessages } from "./fields.messages.js";
import { schemaMessages } from "./messages.js";
import { ADDABLE_KINDS, addField, allFieldNames, collectionLabel, collectionsOf, FIELD_KEY_ORDER, fieldAt, fieldProblems, nameProblem, newField, setProp, suggestedFieldName, withKind, withOpposite, } from "./schema-model.js";
const KIND_ICONS = {
    text: Type,
    select: ListChecks,
    media: Image,
    relation: Link2,
};
/**
 * Adds a field in one step: picking a kind shows its settings right below, so a wrong pick is fixed by picking another. The identifier follows the label (a
 * relation's follows its target, and so does its label) until the writer changes it. `onAdded` gets the name of the new field.
 */
export function AddFieldDialog({ editing, place, onClose, onAdded, }) {
    const t = useTranslator(schemaFieldsMessages);
    const tc = useTranslator(commonMessages);
    const ts = useTranslator(schemaMessages);
    const { collectionNames, file } = useSchemaEdit();
    const [kind, setKind] = useState("text");
    const [draft, setDraft] = useState(() => newField("text", "", collectionNames));
    // `null` while the label (or a relation's target) names the field; set once the writer types a label or an identifier of their own.
    const [typedLabel, setTypedLabel] = useState(null);
    const [typedName, setTypedName] = useState(null);
    const [isNaming, setIsNaming] = useState(false);
    const [opposite, setOpposite] = useState(false);
    const isItem = (target) => typeof target === "string" && collectionsOf(file)[target]?.kind === "item";
    const target = typeof draft.to === "string" ? draft.to : "";
    const field = typedLabel === null && kind === "relation"
        ? setProp(draft, "label", collectionLabel(file, target), FIELD_KEY_ORDER)
        : draft;
    const taken = allFieldNames(editing.collection);
    const name = typedName ?? suggestedFieldName(field, taken);
    const collection = addField(editing.collection, place, name, field);
    const problems = fieldProblems(field, collection, collectionNames);
    const problem = nameProblem(name, taken);
    const label = typeof field.label === "string" ? field.label : "";
    const change = (update) => setDraft((current) => update(current));
    const set = (key, value) => change((current) => {
        const next = setProp(current, key, value, FIELD_KEY_ORDER);
        // A new link to items (tags, categories) lets the writer add one from the input; a link to documents does not.
        return key === "to" ? setProp(next, "createInline", isItem(value) ? true : undefined, FIELD_KEY_ORDER) : next;
    });
    // The fields of a select's options are edited in the collection with the new field in it; only the field is kept.
    const draftEditing = {
        ...editing,
        collection,
        update: (apply) => setDraft((current) => fieldAt(apply(addField(editing.collection, place, name, current)), place, name) ?? current),
        onRename: () => undefined,
    };
    const pickKind = (next) => {
        setKind(next);
        setDraft((current) => {
            const changed = withKind(current, next, collectionNames);
            return next === "relation"
                ? setProp(changed, "createInline", isItem(changed.to) ? true : undefined, FIELD_KEY_ORDER)
                : changed;
        });
    };
    const add = () => {
        if (problem || problems.length > 0 || label.trim() === "")
            return;
        editing.update((current) => addField(current, place, name, field));
        if (opposite && field.kind === "relation" && field.many === true)
            editing.updateFile?.((current) => withOpposite(current, editing.collectionName, name, target, true));
        onAdded(name);
    };
    const naming = (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(TextInput, { label: t("field.label"), value: label, onChange: (value) => {
                    setTypedLabel(value);
                    change((current) => setProp(current, "label", value, FIELD_KEY_ORDER));
                } }), _jsx(Labeled, { label: t("field.identifier"), hint: typedName !== null && problem ? (_jsx("span", { className: "text-monti-destructive", children: ts(`name.${problem}`) })) : undefined, children: isNaming ? (_jsx(Input, { autoFocus: true, value: name, "aria-label": t("field.identifier"), "aria-invalid": problem ? true : undefined, className: "font-mono", onChange: (event) => setTypedName(event.target.value) })) : (_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx("code", { children: name }), _jsx(Button, { type: "button", variant: "link", size: "xs", className: "h-auto p-0", onClick: () => setIsNaming(true), children: t("field.identifierChange") })] })) })] }));
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "max-h-[85vh] overflow-y-auto sm:max-w-lg", "data-testid": "add-field-dialog", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t("field.addTitle") }) }), _jsxs("form", { className: "flex flex-col gap-6", onSubmit: (event) => {
                        event.preventDefault();
                        add();
                    }, children: [_jsx("div", { role: "radiogroup", "aria-label": t("field.kind"), className: "grid grid-cols-4 gap-2", children: ADDABLE_KINDS.map((item) => {
                                const Icon = KIND_ICONS[item];
                                return (_jsxs("button", { type: "button", role: "radio", "aria-checked": item === kind, onClick: () => pickKind(item), className: cn("flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-monti-ring/50", item === kind
                                        ? "border-monti-primary bg-monti-primary/5 font-medium text-monti-foreground"
                                        : "text-monti-muted-foreground hover:bg-monti-muted"), children: [_jsx(Icon, { "aria-hidden": true, className: "size-4" }), t(`kind.${item}`)] }, item));
                            }) }), kind !== "relation" && naming, _jsx(KindOptions, { name: name, field: field, editing: draftEditing, set: set, change: change, place: place, opposite: !place.branch && editing.updateFile ? { on: opposite, onChange: setOpposite } : undefined, more: kind === "relation" ? naming : undefined }), problems.length > 0 && (_jsx("ul", { className: "flex flex-col gap-0.5 text-monti-muted-foreground text-xs", "data-testid": "new-field-problems", children: problems.map((item) => (_jsx("li", { children: t(`field.needs.${item}`) }, item))) })), _jsx(DialogFormFooter, { onCancel: onClose, cancelLabel: tc("cancel"), submitLabel: tc("add"), disabled: Boolean(problem) || problems.length > 0 || label.trim() === "" })] })] }) }));
}
