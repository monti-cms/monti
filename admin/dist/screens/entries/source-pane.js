"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { EditorContent, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useCmsAdminComponents, useSourceFormat } from "../../admin-components.js";
import { documentKey } from "../../editor/document-key.js";
import { buildEditorExtensions } from "../../editor/extensions.js";
import { boxPreviewOf, storedToTiptap } from "../../editor/tiptap-content.js";
import { cn } from "../../lib/utils/cn.js";
import { IconButton } from "../../ui/icon-button.js";
import { entriesMessages } from "./messages.js";
const PROSE = "prose cms-dark:prose-invert max-w-none text-base text-cms-foreground leading-relaxed focus:outline-none " +
    // Read-only: hide the code block tool row and keep collapsible boxes always open.
    "[&_[data-code-ui]]:hidden [&_[data-cms-collapsed]]:block " +
    // The source block matching the block under the cursor in the translation editor (source-sync).
    // Let only a faint background spread around the block, with no bar (a shadow spread, so it does not shift layout and also wraps list bullets).
    "[&_.cms-source-active]:rounded-sm [&_.cms-source-active]:bg-cms-primary/8 [&_.cms-source-active]:shadow-[0_0_0_12px_color-mix(in_oklab,var(--color-cms-primary)_8%,transparent)] [&_.cms-source-active]:transition-[background-color,box-shadow]";
function PreviewEditor({ doc, label }) {
    const site = useSite();
    // Render text-decoration extensions (text color etc.) the same as in the editor.
    const { marks } = useCmsAdminComponents();
    const boxPreview = boxPreviewOf(useSourceFormat());
    const [extensions] = useState(() => buildEditorExtensions(site, marks));
    const editor = useEditor({
        immediatelyRender: false,
        editable: false,
        extensions,
        content: storedToTiptap(site, doc, { boxPreview }),
        editorProps: { attributes: { "aria-label": label, class: PROSE } },
    });
    return _jsx(EditorContent, { editor: editor });
}
/** Read-only preview of a document. Rendered the same as the post. Recreates the editor when the content changes. */
export function DocPreview({ doc, label: labelProp }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    const label = labelProp ?? t("sourcePane.preview");
    const key = useMemo(() => documentKey(site, doc), [doc, site]);
    return _jsx(PreviewEditor, { doc: doc, label: label }, key);
}
/** The full source placed beside the translation. Scrolls separately from the translation editor. */
export function SourcePane({ doc, locale, title, onClose, className, ref, }) {
    const t = useTranslator(entriesMessages);
    return (_jsxs("aside", { ref: ref, "aria-label": t("sourcePane.aria"), className: cn("flex h-full min-w-0 flex-col overflow-y-auto border-r bg-cms-background", className), children: [_jsxs("div", { "data-source-header": true, className: "sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-cms-background/95 px-4 backdrop-blur", children: [_jsx("h2", { className: "flex-1 font-medium text-sm", children: t("sourcePane.heading", { locale: locale.toUpperCase() }) }), _jsx(IconButton, { label: t("close"), side: "bottom", onClick: onClose, children: _jsx(X, { "aria-hidden": true, className: "size-4" }) })] }), _jsx("h1", { className: cn("px-6 pt-12 pb-5 font-semibold text-[34px] leading-tight tracking-tight", !title && "text-cms-muted-foreground/40"), children: title || t("untitled") }), _jsx("div", { className: "px-6 pt-6 pb-[35vh]", children: _jsx(DocPreview, { doc: doc, label: t("sourcePane.body") }) })] }));
}
