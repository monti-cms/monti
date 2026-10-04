"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, createTranslator, fileKindOf, fileTypeLabel, formatFileSize, } from "@monti-cms/core/client";
import { NodeViewWrapper } from "@tiptap/react";
import { FileArchive, FileText, FileType } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils/cn.js";
import { SELECTED_RING, useEditorEditable } from "./blocks/shared.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
const ICONS = { pdf: FileType, archive: FileArchive, text: FileText };
/** Attached file card in the editor. Same look as the public view card, and the name can be edited directly. */
export function CmsFileNodeView({ node, updateAttributes, selected, editor }) {
    const mediaId = typeof node.attrs.mediaId === "string" ? node.attrs.mediaId : "";
    const label = typeof node.attrs.label === "string" ? node.attrs.label : "";
    const [media, setMedia] = useState(null);
    const editable = useEditorEditable(editor);
    useEffect(() => {
        if (!mediaId)
            return;
        let cancelled = false;
        fetch(cmsApiUrl(`/v1/media/${encodeURIComponent(mediaId)}`))
            .then(async (response) => {
            if (!response.ok)
                throw new Error("media_lookup_failed");
            return (await response.json());
        })
            .then((result) => !cancelled && setMedia(result))
            .catch(() => !cancelled && setMedia("failed"));
        return () => {
            cancelled = true;
        };
    }, [mediaId]);
    const info = media && media !== "failed" ? media : null;
    const filename = info?.filename ?? "";
    const Icon = ICONS[fileKindOf(info?.mimeType)];
    const details = media === "failed"
        ? t("fileNode.notFound")
        : info
            ? [fileTypeLabel(filename, info.mimeType), info.byteSize ? formatFileSize(info.byteSize) : null]
                .filter(Boolean)
                .join(" · ")
            : t("fileNode.loading");
    return (_jsxs(NodeViewWrapper, { "data-file-block": true, className: cn("not-prose my-6 flex items-center gap-3 rounded-lg border bg-cms-card px-4 py-3", selected && SELECTED_RING), children: [_jsx(Icon, { "aria-hidden": true, className: "size-8 shrink-0 text-cms-muted-foreground", strokeWidth: 1.5 }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("input", { "aria-label": t("fileNode.displayName"), value: label, placeholder: filename || t("fileNode.fallbackName"), disabled: !editable, 
                        // Keep typed characters from leaking into the editor document.
                        onKeyDown: (event) => event.stopPropagation(), onChange: (event) => updateAttributes({ label: event.target.value || null }), className: "w-full truncate bg-transparent font-medium text-sm outline-none placeholder:text-cms-foreground" }), _jsx("p", { className: cn("text-cms-muted-foreground text-xs", media === "failed" && "text-cms-destructive"), children: details })] })] }));
}
