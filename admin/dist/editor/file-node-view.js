"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, fileKindOf, fileTypeLabel, formatFileSize, useTranslator, } from "@monti-cms/core/client";
import { FileArchive, FileText, FileType } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils/cn.js";
import { BlockFrame, useBlockEditor } from "./blocks/use-block-editor.js";
import { editorMessages } from "./messages.js";
const ICONS = { pdf: FileType, archive: FileArchive, text: FileText };
/** Edit view of the core file block (`blockViews.file`): the attached file card. Same look as the public view card, and the name can be edited directly. */
export function FileBlockView() {
    const t = useTranslator(editorMessages);
    const block = useBlockEditor();
    const mediaId = typeof block.values.mediaId === "string" ? block.values.mediaId : "";
    const label = typeof block.values.label === "string" ? block.values.label : "";
    const [media, setMedia] = useState(null);
    const { editable } = block;
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
    return (_jsxs(BlockFrame, { framed: false, "data-file-block": true, className: "not-prose my-6 flex items-center gap-3 rounded-lg border bg-cms-card px-4 py-3", children: [_jsx(Icon, { "aria-hidden": true, className: "size-8 shrink-0 text-cms-muted-foreground", strokeWidth: 1.5 }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("input", { "aria-label": t("fileNode.displayName"), value: label, placeholder: filename || t("fileNode.fallbackName"), disabled: !editable, 
                        // Keep typed characters from leaking into the editor document.
                        onKeyDown: (event) => event.stopPropagation(), onChange: (event) => block.setValues({ label: event.target.value || null }), className: "w-full truncate bg-transparent font-medium text-sm outline-none placeholder:text-cms-foreground" }), _jsx("p", { className: cn("text-cms-muted-foreground text-xs", media === "failed" && "text-cms-destructive"), children: details })] })] }));
}
