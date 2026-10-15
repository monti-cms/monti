"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { useId, useState } from "react";
import { commonMessages } from "../../lib/common.messages.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { DialogFormFooter } from "../../ui/dialog-form-footer.js";
import { FieldError } from "../../ui/field.js";
import { Input } from "../../ui/input.js";
import { Labeled } from "../shared/labeled.js";
import { schemaCollectionMessages } from "./collection.messages.js";
import { schemaMessages } from "./messages.js";
import { PublicPathField } from "./public-path-field.js";
import { defaultPath, idFromName, nameProblem, pathProblem } from "./schema-model.js";
/** Display name, identifier, kind and public address of a new collection. The identifier follows the name and the address follows the identifier, each until the writer types one of their own. */
export function NewCollectionDialog({ open, onOpenChange, taken, onCreate, }) {
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsx(DialogContent, { "data-testid": "new-collection-dialog", children: _jsx(NewCollectionForm, { taken: taken, onCancel: () => onOpenChange(false), onCreate: onCreate }) }) }));
}
function NewCollectionForm({ taken, onCancel, onCreate, }) {
    const t = useTranslator(schemaCollectionMessages);
    const tc = useTranslator(commonMessages);
    const ts = useTranslator(schemaMessages);
    const nameId = useId();
    const idFieldId = useId();
    const [name, setName] = useState("");
    // `null`: not typed yet, so the identifier is the one the name suggests.
    const [typedId, setTypedId] = useState(null);
    const [kind, setKind] = useState("document");
    // `null`: not typed yet, so the address is the one the identifier and kind suggest.
    const [typedPath, setTypedPath] = useState(null);
    const id = typedId ?? idFromName(name);
    const path = typedPath ?? (kind === "document" ? defaultPath(id) : "");
    const idIssue = id === "" ? (name.trim() === "" ? null : "idEmpty") : nameProblem(id, taken);
    const pathIssue = pathProblem(path);
    const ready = name.trim() !== "" && id !== "" && idIssue === null && pathIssue === null;
    const kinds = [
        { value: "document", label: ts("collection.kindDocument"), explain: t("collection.kindDocumentExplain") },
        { value: "item", label: ts("collection.kindItem"), explain: t("collection.kindItemExplain") },
    ];
    const submit = () => {
        if (ready)
            onCreate(id, kind, path.trim(), name.trim());
    };
    return (_jsxs("form", { className: "grid gap-5", onSubmit: (event) => {
            event.preventDefault();
            submit();
        }, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("collection.createTitle") }), _jsx(DialogDescription, { children: t("collection.createDescription") })] }), _jsx(Labeled, { label: t("collection.newName"), htmlFor: nameId, hint: t("collection.newNameHint"), children: _jsx(Input, { id: nameId, value: name, placeholder: "Blog posts", autoComplete: "off", onChange: (event) => setName(event.target.value) }) }), _jsxs(Labeled, { label: t("collection.newId"), htmlFor: idFieldId, hint: t("collection.newIdHint"), children: [_jsx(Input, { id: idFieldId, value: id, placeholder: "blog-posts", autoComplete: "off", "aria-invalid": idIssue ? true : undefined, onChange: (event) => setTypedId(event.target.value) }), idIssue && _jsx(FieldError, { className: "text-xs", children: ts(`name.${idIssue}`) })] }), _jsxs("fieldset", { className: "flex flex-col gap-2", children: [_jsx("legend", { className: "mb-1.5 font-medium text-xs", children: t("collection.kind") }), kinds.map((item) => (_jsxs("label", { className: "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 has-checked:border-cms-primary has-checked:bg-cms-accent/40", children: [_jsx("input", { type: "radio", name: "new-collection-kind", value: item.value, checked: kind === item.value, onChange: () => setKind(item.value), className: "mt-0.5" }), _jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "font-medium text-sm", children: item.label }), _jsx("span", { className: "text-cms-muted-foreground text-xs", children: item.explain })] })] }, item.value)))] }), _jsx(PublicPathField, { path: path, suggested: defaultPath(id), onChange: setTypedPath }), _jsx(DialogFormFooter, { onCancel: onCancel, cancelLabel: tc("cancel"), submitLabel: t("collection.createConfirm"), disabled: !ready })] }));
}
