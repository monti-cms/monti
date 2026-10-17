"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { EditorContent, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAdminComponents, useSourceFormat } from "../../admin-components.js";
import { documentKey } from "../../editor/document-key.js";
import { buildEditorExtensions } from "../../editor/extensions.js";
import { boxPreviewOf, storedToTiptap } from "../../editor/tiptap-content.js";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { IconButton } from "../../ui/icon-button.js";
import { entriesMessages } from "./messages.js";
import { ACTIVE_BLOCK_STYLE } from "./source-sync.js";
const PROSE = "prose monti-dark:prose-invert max-w-none text-base text-monti-foreground leading-relaxed focus:outline-none " +
    // Read-only: hide the code block tool row. A collapsible box is open unless the translation box it is paired with is collapsed (source-sync).
    `[&_[data-code-ui]]:hidden [&_[data-monti-collapsed]]:block [&_[data-source-collapsed]]:hidden! ${ACTIVE_BLOCK_STYLE}`;
function PreviewEditor({ doc, label }) {
    const site = useSite();
    // Render text-decoration extensions (text color etc.) the same as in the editor.
    const { marks } = useAdminComponents();
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
    const tc = useTranslator(commonMessages);
    return (_jsxs("aside", { ref: ref, "aria-label": t("sourcePane.aria"), className: cn("flex h-full min-w-0 flex-col overflow-y-auto border-r bg-monti-background", className), children: [_jsxs("div", { "data-source-header": true, className: "sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-monti-background/95 px-4 backdrop-blur", children: [_jsx("h2", { className: "flex-1 font-medium text-sm", children: t("sourcePane.heading", { locale: locale.toUpperCase() }) }), _jsx(IconButton, { label: tc("close"), side: "bottom", onClick: onClose, children: _jsx(X, { "aria-hidden": true, className: "size-4" }) })] }), _jsx("h1", { className: cn("px-6 pt-12 pb-5 font-semibold text-[34px] leading-tight tracking-tight", !title && "text-monti-muted-foreground/40"), children: title || tc("untitled") }), _jsx("div", { className: "px-6 pt-6 pb-[35vh]", children: _jsx(DocPreview, { doc: doc, label: t("sourcePane.body") }) })] }));
}
