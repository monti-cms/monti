"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { useId, useState } from "react";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { FieldError } from "../../ui/field.js";
import { Input } from "../../ui/input.js";
import { Labeled } from "./controls.js";
import { schemaMessages } from "./messages.js";
import { defaultPath, nameProblem, pathProblem } from "./schema-model.js";
/** Name, kind and public address of a new collection. The address follows the name until the writer types one of their own. */
export function NewCollectionDialog({ open, onOpenChange, taken, onCreate, }) {
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsx(DialogContent, { "data-testid": "new-collection-dialog", children: _jsx(NewCollectionForm, { taken: taken, onCancel: () => onOpenChange(false), onCreate: onCreate }) }) }));
}
function NewCollectionForm({ taken, onCancel, onCreate, }) {
    const t = useTranslator(schemaMessages);
    const nameId = useId();
    const pathId = useId();
    const [name, setName] = useState("");
    const [kind, setKind] = useState("document");
    // `null`: not typed yet, so the address is the one the name and kind suggest.
    const [typedPath, setTypedPath] = useState(null);
    const path = typedPath ?? (kind === "document" ? defaultPath(name) : "");
    const nameIssue = name === "" ? null : nameProblem(name, taken);
    const pathIssue = pathProblem(path);
    const ready = name !== "" && nameIssue === null && pathIssue === null;
    const kinds = [
        { value: "document", label: t("collection.kindDocument"), explain: t("collection.kindDocumentExplain") },
        { value: "item", label: t("collection.kindItem"), explain: t("collection.kindItemExplain") },
    ];
    const submit = () => {
        if (ready)
            onCreate(name, kind, path.trim());
    };
    return (_jsxs("form", { className: "grid gap-5", onSubmit: (event) => {
            event.preventDefault();
            submit();
        }, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("collection.createTitle") }), _jsx(DialogDescription, { children: t("collection.createDescription") })] }), _jsxs(Labeled, { label: t("collection.newName"), htmlFor: nameId, hint: t("collection.newNameHint"), children: [_jsx(Input, { id: nameId, value: name, placeholder: "article", autoComplete: "off", "aria-invalid": nameIssue ? true : undefined, onChange: (event) => setName(event.target.value) }), nameIssue && _jsx(FieldError, { className: "text-xs", children: t(`name.${nameIssue}`) })] }), _jsxs("fieldset", { className: "flex flex-col gap-2", children: [_jsx("legend", { className: "mb-1.5 font-medium text-xs", children: t("collection.kind") }), kinds.map((item) => (_jsxs("label", { className: "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 has-checked:border-cms-primary has-checked:bg-cms-accent/40", children: [_jsx("input", { type: "radio", name: "new-collection-kind", value: item.value, checked: kind === item.value, onChange: () => setKind(item.value), className: "mt-0.5" }), _jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "font-medium text-sm", children: item.label }), _jsx("span", { className: "text-cms-muted-foreground text-xs", children: item.explain })] })] }, item.value)))] }), _jsxs(Labeled, { label: t("collection.path"), htmlFor: pathId, hint: `${t("collection.pathHint")} ${t("collection.newPathHint")}`, children: [_jsx(Input, { id: pathId, value: path, placeholder: "/posts/:slug", autoComplete: "off", "aria-invalid": pathIssue ? true : undefined, onChange: (event) => setTypedPath(event.target.value) }), pathIssue && _jsx(FieldError, { className: "text-xs", children: t(`path.${pathIssue}`) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onCancel, children: t("collection.createCancel") }), _jsx(Button, { type: "submit", disabled: !ready, children: t("collection.createConfirm") })] })] }));
}
