"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fileTypeLabel, formatFileSize, useSite, useTranslator, withBasePath } from "@monti-cms/core/client";
import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { formatBytes } from "../../editor/upload-helper.js";
import { cn } from "../../lib/utils/cn.js";
import { SlotScope } from "../../slots/slots.js";
import { Button, buttonVariants } from "../../ui/button.js";
import { Field, FieldLabel } from "../../ui/field.js";
import { Textarea } from "../../ui/textarea.js";
import { errorText } from "../admin-api.js";
import { entryHref } from "../shared/entry-href.js";
import { formatDateTime } from "../shared/format-date.js";
import { SidePanelHeader } from "../shared/side-panel.js";
import { copyText, mediaUsages, usageCount, usageNoteLabel, withExtension } from "./media-item.js";
import { MediaThumb } from "./media-views.js";
import { mediaMessages } from "./messages.js";
/** One group in the detail. A small title, with the content below it. */
function Section({ title, children }) {
    return (_jsxs("section", { className: "space-y-3 border-t px-4 py-4", children: [_jsx("h3", { className: "font-medium text-[11px] text-cms-muted-foreground uppercase tracking-wide", children: title }), children] }));
}
/** Item name on top, value below. Long values (ID, file name) do not push out the name column. */
function Row({ label, children }) {
    return (_jsxs("div", { className: "space-y-0.5", children: [_jsx("dt", { className: "text-[11px] text-cms-muted-foreground", children: label }), _jsx("dd", { className: "break-all", children: children })] }));
}
/**
 * Media detail. Opens on the right whichever view (grid or list) it was picked from.
 * From the top: preview -> immediate actions (copy URL/ID, open) -> info -> default description (images) -> usages -> delete.
 * Name and default description have AI slots (file name, alt text, caption suggestions). The default description is saved only by pressing `Save`,
 * and unsaved changes are reported through `onDirtyChange` (used to ask before opening or closing another file).
 */
export function MediaDetailPanel({ media, className, onClose, onSaveDefaults, onRename, onRequestDelete, onDirtyChange, }) {
    const site = useSite();
    const t = useTranslator(mediaMessages);
    const altId = useId();
    const captionId = useId();
    // The last saved (initially loaded) value. If the edited value differs, there are unsaved changes.
    const [saved, setSaved] = useState({ alt: media.defaultAlt, caption: media.defaultCaption });
    const [draft, setDraft] = useState(saved);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const isImage = site.api.isImageMime(media.mimeType);
    const isDirty = draft.alt !== saved.alt || draft.caption !== saved.caption;
    useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
    const saveDefaults = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSaveDefaults(draft);
            setSaved(draft);
        }
        catch (error) {
            setSaveError(errorText(site, error, t("library.saveFailed")));
        }
        finally {
            setIsSaving(false);
        }
    };
    /** Media file slot. Looks at the image content and suggests a name and default description. */
    const slot = (target, apply) => ({
        slot: "media",
        target,
        scope: media.id,
        disabled: media.status !== "ready" || !isImage,
        getContext: () => ({
            mediaId: media.id,
            filename: media.filename,
            current: target === "filename" ? media.filename : target === "defaultAlt" ? draft.alt : draft.caption,
        }),
        apply,
    });
    return (_jsxs("aside", { "aria-label": t("detail.label"), className: cn("flex h-full flex-col border-l bg-cms-background text-xs", className), children: [_jsx(SidePanelHeader, { title: media.filename, onClose: onClose }), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto", children: [_jsxs("div", { className: "space-y-3 p-4", children: [_jsx("div", { className: "flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-cms-muted/50", children: isImage && media.publicUrl ? (_jsx("img", { src: media.publicUrl, alt: "", className: "max-h-full max-w-full object-contain" })) : (_jsxs("span", { className: "flex flex-col items-center gap-2 text-cms-muted-foreground", children: [_jsx(MediaThumb, { media: media, iconClassName: "size-12" }), _jsx("span", { className: "font-medium", children: fileTypeLabel(media.filename, media.mimeType) })] })) }), _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [media.publicUrl && (_jsxs(_Fragment, { children: [_jsxs(Button, { type: "button", variant: "outline", size: "xs", onClick: () => void copyText(t, media.publicUrl, t("detail.copiedUrl")), children: [_jsx(Copy, { "aria-hidden": true }), t("detail.copyUrl")] }), _jsxs("a", { href: media.publicUrl, target: "_blank", rel: "noopener noreferrer", className: buttonVariants({ variant: "outline", size: "xs" }), children: [_jsx(ExternalLink, { "aria-hidden": true }), t("common.open")] })] })), _jsxs(Button, { type: "button", variant: "outline", size: "xs", "aria-label": t("detail.copyIdLabel"), onClick: () => void copyText(t, media.id, t("detail.copiedId")), children: [_jsx(Copy, { "aria-hidden": true }), t("detail.copyId")] })] })] }), _jsx(Section, { title: t("detail.section.info"), children: _jsxs("dl", { className: "space-y-3", children: [_jsx(SlotScope, { request: slot("filename", (stem) => onRename(withExtension(stem, media.filename))), children: ({ trigger, panel }) => (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-start gap-1", children: [_jsx("div", { className: "min-w-0 flex-1", children: _jsx(Row, { label: t("detail.row.filename"), children: media.filename }) }), isImage && trigger] }), panel] })) }, `filename-${media.id}`), _jsx(Row, { label: t("detail.row.type"), children: isImage ? (media.mimeType ?? "—") : fileTypeLabel(media.filename, media.mimeType) }), isImage ? (_jsxs(Row, { label: t("detail.row.public"), children: [media.width, "\u00D7", media.height, " \u00B7 ", formatBytes(media.byteSize ?? 0)] })) : (_jsx(Row, { label: t("detail.row.size"), children: formatFileSize(media.byteSize ?? 0) })), isImage && media.original && (_jsxs(Row, { label: t("detail.row.original"), children: [media.original.width, "\u00D7", media.original.height, " \u00B7 ", formatBytes(media.original.byteSize ?? 0), " \u00B7", " ", media.original.mimeType] })), _jsx(Row, { label: t("detail.row.uploadedAt"), children: formatDateTime(site, media.createdAt) }), _jsx(Row, { label: t("detail.row.id"), children: _jsx("code", { className: "text-[11px]", children: media.id }) })] }) }), isImage && (_jsxs(Section, { title: t("detail.section.defaults"), children: [_jsx("p", { className: "text-cms-muted-foreground", children: t("detail.defaultsHelp") }), _jsxs("form", { className: "space-y-3", onSubmit: (event) => {
                                    event.preventDefault();
                                    void saveDefaults();
                                }, children: [_jsx(SlotScope, { request: slot("defaultAlt", (alt) => setDraft((current) => ({ ...current, alt }))), children: ({ trigger, panel }) => (_jsxs(Field, { children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx(FieldLabel, { htmlFor: altId, children: t("detail.defaultAlt") }), trigger] }), _jsx(Textarea, { id: altId, rows: 2, value: draft.alt, disabled: isSaving, onChange: (event) => setDraft({ ...draft, alt: event.target.value }), className: "min-h-14 text-xs md:text-xs" }), panel] })) }, `alt-${media.id}`), _jsx(SlotScope, { request: slot("defaultCaption", (caption) => setDraft((current) => ({ ...current, caption }))), children: ({ trigger, panel }) => (_jsxs(Field, { children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx(FieldLabel, { htmlFor: captionId, children: t("detail.defaultCaption") }), trigger] }), _jsx(Textarea, { id: captionId, rows: 2, value: draft.caption, disabled: isSaving, onChange: (event) => setDraft({ ...draft, caption: event.target.value }), className: "min-h-14 text-xs md:text-xs" }), panel] })) }, `caption-${media.id}`), saveError && (_jsx("p", { role: "alert", className: "text-cms-destructive", children: saveError })), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "submit", size: "sm", disabled: media.status !== "ready" || isSaving, children: isSaving ? t("common.saving") : t("common.save") }) })] })] })), _jsx(Section, { title: t("detail.section.usage", { count: usageCount(media) }), children: media.referencesCount === 0 ? (_jsx("p", { className: "text-cms-muted-foreground", children: t("detail.noUsage") })) : (_jsx("ul", { className: "space-y-1", children: mediaUsages(media).map((usage) => (_jsx("li", { children: _jsxs("a", { href: withBasePath(entryHref(site, usage.collection, usage.entryId)), className: "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-cms-accent", children: [_jsx("span", { className: "min-w-0 flex-1 truncate", children: usage.title || t("common.untitled") }), usage.note && (_jsx("span", { className: "shrink-0 text-cms-muted-foreground text-xs", children: usageNoteLabel(t, usage.note) }))] }) }, usage.entryId))) })) })] }), _jsxs("div", { className: "shrink-0 space-y-1.5 border-t px-4 py-3", children: [_jsx(Button, { type: "button", variant: "destructive", size: "sm", className: "w-full", disabled: media.referencesCount > 0, onClick: onRequestDelete, children: media.status === "deleting" ? t("detail.retryDelete") : t("common.delete") }), media.referencesCount > 0 && (_jsx("p", { className: "text-center text-[11px] text-cms-muted-foreground", children: t("detail.inUse") }))] })] }));
}
