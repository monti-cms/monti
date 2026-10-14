"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { useState } from "react";
import { commonMessages } from "../../lib/common.messages.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { DialogFormFooter } from "../../ui/dialog-form-footer.js";
import { Input } from "../../ui/input.js";
import { Labeled } from "../shared/labeled.js";
import { Pick, useSchemaEdit } from "./controls.js";
import { NewFieldDialog } from "./field-editor.js";
import { schemaFieldsMessages } from "./fields.messages.js";
import { schemaMessages } from "./messages.js";
import { addField, allFieldNames, FIELD_KINDS, KINDS_WITH_SETTINGS, nameProblem, newField, VALUE_KINDS, } from "./schema-model.js";
/**
 * Adds a field in two steps: a name and a kind first; a kind that cannot exist without settings (a choice, a relation, a conditional field...) then asks for them in
 * a second dialog before the field is made. `onAdded` gets the name of the new field so the caller can open its editor.
 */
export function AddFieldDialog({ editing, place, onClose, onAdded, }) {
    const t = useTranslator(schemaFieldsMessages);
    const tc = useTranslator(commonMessages);
    const ts = useTranslator(schemaMessages);
    const { collectionNames } = useSchemaEdit();
    const [name, setName] = useState("");
    const [kind, setKind] = useState("text");
    const [pending, setPending] = useState(false);
    const kinds = place.branch ? VALUE_KINDS : FIELD_KINDS;
    const taken = allFieldNames(editing.collection);
    const problem = nameProblem(name, taken);
    const submit = () => {
        if (problem)
            return;
        if (KINDS_WITH_SETTINGS.includes(kind)) {
            setPending(true);
            return;
        }
        editing.update((collection) => addField(collection, place, name, newField(kind, name.charAt(0).toUpperCase() + name.slice(1), collectionNames)));
        onAdded(name);
    };
    if (pending) {
        return (_jsx(NewFieldDialog, { editing: editing, place: place, name: name, kind: kind, onClose: (added) => {
                if (added)
                    onAdded(name);
                else
                    onClose();
            } }));
    }
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", "data-testid": "add-field-dialog", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("field.addTitle") }), _jsx(DialogDescription, { children: t("field.addDescription") })] }), _jsxs("form", { className: "flex flex-col gap-6", onSubmit: (event) => {
                        event.preventDefault();
                        submit();
                    }, children: [_jsx(Labeled, { label: t("field.newName"), hint: name !== "" && problem ? _jsx("span", { className: "text-cms-destructive", children: ts(`name.${problem}`) }) : undefined, children: _jsx(Input, { autoFocus: true, value: name, "aria-label": t("field.newName"), placeholder: "fieldName", "aria-invalid": name !== "" && problem ? true : undefined, onChange: (event) => setName(event.target.value) }) }), _jsx(Pick, { label: t("field.kind"), value: kind, items: kinds.map((item) => ({ value: item, label: t(`kind.${item}`) })), onChange: (next) => setKind(next) }), _jsx(DialogFormFooter, { onCancel: onClose, cancelLabel: tc("cancel"), submitLabel: tc("add"), disabled: Boolean(problem) })] })] }) }));
}
