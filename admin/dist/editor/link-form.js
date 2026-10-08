"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { TextSelection } from "@tiptap/pm/state";
import { Unlink } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { LinkTargetSummary } from "./link-target-view.js";
import { editorMessages } from "./messages.js";
export function normalizeLinkHref(value) {
    const href = value.trim();
    if (!href || /\s/.test(href))
        return null;
    if ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#"))
        return href;
    if (/^mailto:[^@\s]+@[^@\s]+$/i.test(href))
        return href;
    if (/^https?:\/\//i.test(href)) {
        try {
            return new URL(href).href;
        }
        catch {
            return null;
        }
    }
    if (/^[^/:?#\s]+\.[^/:?#\s]{2,}(?:[/?#].*)?$/i.test(href))
        return `https://${href}`;
    return null;
}
export function linkDraftFromSelection(editor) {
    const { from, to } = editor.state.selection;
    const existing = editor.isActive("link");
    const attrs = existing ? editor.getAttributes("link") : {};
    // An internal link is shown by the entry it points to; the address it carries is only what the editor displays.
    const entryId = typeof attrs.entryId === "string" && attrs.entryId ? attrs.entryId : null;
    return { from, to, existing, href: entryId ? "" : String(attrs.href ?? ""), entryId };
}
/** Collapses the cursor to the end of the effect after applying it. With the cursor at the end of the effect, the inline bubble shows the applied result. */
export const collapseToEnd = (chain) => chain.command(({ tr }) => {
    tr.setSelection(TextSelection.near(tr.doc.resolve(tr.selection.to), -1));
    return true;
});
/** Whether this Enter finishes Korean composition. The form is not submitted then. */
export const isComposingKey = (event) => event.nativeEvent.isComposing || event.key === "Process" || event.keyCode === 229;
/**
 * Enter handling for popover input forms (link, tooltip). Enter during Korean composition is ignored, and Enter submits even in multi-line fields (Shift+Enter inserts a line break).
 * Attach it as `<form onKeyDown={submitOnEnter}>`.
 */
export function submitOnEnter(event) {
    if (event.key !== "Enter")
        return;
    if (isComposingKey(event)) {
        event.preventDefault();
        return;
    }
    if (event.target instanceof HTMLTextAreaElement && !event.shiftKey) {
        event.preventDefault();
        event.currentTarget.requestSubmit();
    }
}
/** Button row below a popover input form: remove on the left, cancel and apply on the right. Shared by the link and tooltip forms. */
export function PopoverFormFooter({ removeLabel, removeIcon, onRemove, onCancel, }) {
    const t = useTranslator(editorMessages);
    return (_jsxs("div", { className: "flex items-center gap-2", children: [onRemove && (_jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive", onClick: onRemove, children: [removeIcon, removeLabel] })), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: onCancel, children: t("popoverForm.cancel") }), _jsx(Button, { type: "submit", size: "sm", children: t("popoverForm.apply") })] })] }));
}
/** One-line red error of a popover input form. */
export function PopoverFormError({ id, children }) {
    return (_jsx("p", { id: id, role: "alert", className: "text-cms-destructive text-xs", children: children }));
}
/** Link address input form. Shared by the top formatting toolbar's popover and the inline bubble. */
export function LinkForm({ editor, draft, onDone }) {
    const t = useTranslator(editorMessages);
    const id = useId();
    const [href, setHref] = useState(draft.href);
    const [text, setText] = useState(() => draft.from === draft.to ? "" : editor.state.doc.textBetween(draft.from, draft.to));
    const [error, setError] = useState(null);
    const needsText = !draft.existing && draft.from === draft.to;
    const submit = (event) => {
        event.preventDefault();
        // An internal link with nothing typed stays as it is.
        if (draft.entryId && !href.trim()) {
            onDone();
            return;
        }
        const normalized = normalizeLinkHref(href);
        if (!normalized) {
            setError(t("link.invalid"));
            return;
        }
        const command = editor.chain().focus().setTextSelection({ from: draft.from, to: draft.to });
        // An address typed here replaces the entry an internal link pointed to.
        const attrs = { href: normalized, entryId: null };
        if (draft.existing)
            collapseToEnd(command.extendMarkRange("link").setLink(attrs)).run();
        else if (!needsText)
            collapseToEnd(command.setLink(attrs)).run();
        else
            command
                .insertContent({
                type: "text",
                text: text.trim() || normalized,
                marks: [{ type: "link", attrs: { href: normalized } }],
            })
                .run();
        onDone();
    };
    const remove = () => {
        editor
            .chain()
            .focus()
            .setTextSelection({ from: draft.from, to: draft.to })
            .extendMarkRange("link")
            .unsetLink()
            .setTextSelection({ from: draft.from, to: draft.to })
            .run();
        onDone();
    };
    return (_jsxs("form", { onSubmit: submit, onKeyDown: submitOnEnter, className: "grid gap-3", children: [_jsx("p", { className: "font-medium", children: draft.existing ? t("link.edit") : t("link.add") }), draft.entryId && _jsx(LinkTargetSummary, { entryId: draft.entryId }), needsText && (_jsxs("label", { htmlFor: `${id}-text`, className: "grid gap-1.5 text-xs", children: [t("link.text"), _jsx(Input, { id: `${id}-text`, value: text, onChange: (event) => setText(event.target.value), placeholder: t("link.textPlaceholder") })] })), _jsxs("label", { htmlFor: `${id}-href`, className: "grid gap-1.5 text-xs", children: [t("link.href"), _jsx(Input, { id: `${id}-href`, autoFocus: true, value: href, "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-error` : undefined, onChange: (event) => {
                            setHref(event.target.value);
                            setError(null);
                        }, placeholder: "https://example.com" })] }), error && _jsx(PopoverFormError, { id: `${id}-error`, children: error }), _jsx(PopoverFormFooter, { removeLabel: t("link.remove"), removeIcon: _jsx(Unlink, { "aria-hidden": true }), onRemove: draft.existing ? remove : undefined, onCancel: onDone })] }));
}
