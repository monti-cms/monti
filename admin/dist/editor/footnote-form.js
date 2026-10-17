"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { X } from "lucide-react";
import { useId, useState } from "react";
import { Textarea } from "../ui/textarea.js";
import { FOOTNOTE_DEFINITION_NAME, FOOTNOTE_REFERENCE_NAME, footnoteKey, labelOf } from "./footnote-nodes.js";
import { PopoverFormError, PopoverFormFooter, submitOnEnter } from "./link-form.js";
import { editorMessages } from "./messages.js";
/** Updates the footnote definition block text for a given label in the editor document. */
export function setFootnoteDefinitionText(editor, label, text) {
    const key = footnoteKey(label);
    const schema = editor.state.schema;
    const definitionType = schema.nodes[FOOTNOTE_DEFINITION_NAME];
    const paragraphType = schema.nodes.paragraph;
    if (!definitionType || !paragraphType)
        return false;
    const trimmed = text.trim();
    const lines = trimmed ? trimmed.split(/\n+/) : [];
    const paragraphs = lines.length > 0
        ? lines.map((line) => (line ? paragraphType.create(null, schema.text(line)) : paragraphType.create()))
        : [paragraphType.create()];
    const newDefinition = definitionType.create({ label }, paragraphs);
    let defPos = null;
    let defNodeSize = 0;
    editor.state.doc.descendants((node, pos) => {
        if (node.type.name === FOOTNOTE_DEFINITION_NAME && footnoteKey(labelOf(node)) === key) {
            defPos = pos;
            defNodeSize = node.nodeSize;
            return false;
        }
    });
    return editor
        .chain()
        .focus()
        .command(({ tr }) => {
        if (defPos !== null) {
            tr.replaceWith(defPos, defPos + defNodeSize, newDefinition);
        }
        else {
            const last = tr.doc.lastChild;
            const at = last?.type.name === "paragraph" && last.content.size === 0 && tr.doc.childCount > 1
                ? tr.doc.content.size - last.nodeSize
                : tr.doc.content.size;
            tr.insert(at, newDefinition);
        }
        return true;
    })
        .run();
}
/** Removes a footnote reference chip and its definition block if no other reference uses the label. */
export function removeFootnote(editor, target) {
    const key = footnoteKey(target.label);
    return editor
        .chain()
        .focus()
        .command(({ tr }) => {
        tr.delete(target.from, target.to);
        let hasOtherRef = false;
        tr.doc.descendants((node) => {
            if (node.type.name === FOOTNOTE_REFERENCE_NAME && footnoteKey(labelOf(node)) === key) {
                hasOtherRef = true;
                return false;
            }
        });
        if (!hasOtherRef) {
            let defPos = null;
            let defSize = 0;
            tr.doc.descendants((node, pos) => {
                if (node.type.name === FOOTNOTE_DEFINITION_NAME && footnoteKey(labelOf(node)) === key) {
                    defPos = pos;
                    defSize = node.nodeSize;
                    return false;
                }
            });
            if (defPos !== null) {
                tr.delete(defPos, defPos + defSize);
            }
        }
        return true;
    })
        .run();
}
export function FootnoteForm({ editor, target, onDone }) {
    const t = useTranslator(editorMessages);
    const id = useId();
    const [value, setValue] = useState(target.defText);
    const [error, setError] = useState(null);
    const handleApply = (event) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) {
            setError(t("inlineBubble.footnoteEmpty"));
            return;
        }
        setFootnoteDefinitionText(editor, target.label, trimmed);
        editor.chain().focus().setTextSelection(target.to).run();
        onDone();
    };
    const handleRemove = () => {
        removeFootnote(editor, target);
        onDone();
    };
    return (_jsxs("form", { onSubmit: handleApply, onKeyDown: submitOnEnter, className: "grid gap-3", children: [_jsxs("div", { className: "flex items-center gap-1.5 font-medium", children: [_jsx("span", { className: "flex size-5 shrink-0 items-center justify-center rounded bg-monti-accent font-medium text-monti-accent-foreground text-xs leading-none", children: target.badge }), _jsx("span", { children: t("inlineBubble.footnotePanel") })] }), _jsxs("label", { htmlFor: `${id}-content`, className: "grid gap-1.5 text-xs", children: [t("inlineBubble.footnoteField"), _jsx(Textarea, { id: `${id}-content`, value: value, rows: 3, placeholder: t("inlineBubble.footnotePlaceholder"), "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-error` : undefined, onChange: (event) => {
                            setValue(event.target.value);
                            setError(null);
                        }, className: "min-h-0", autoFocus: true })] }), error && _jsx(PopoverFormError, { id: `${id}-error`, children: error }), _jsx(PopoverFormFooter, { removeLabel: t("inlineBubble.footnoteRemove"), removeIcon: _jsx(X, { "aria-hidden": true }), onRemove: handleRemove, onCancel: onDone })] }));
}
