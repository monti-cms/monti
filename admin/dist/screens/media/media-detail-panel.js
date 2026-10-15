"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fileTypeLabel, formatFileSize, useSite, useTranslator, withBasePath } from "@monti-cms/core/client";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { errorText } from "../../api/client.js";
import { formatBytes } from "../../editor/upload-helper.js";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { SlotScope } from "../../slots/slots.js";
import { Button, buttonVariants } from "../../ui/button.js";
import { Field, FieldError, FieldLabel } from "../../ui/field.js";
import { IconButton } from "../../ui/icon-button.js";
import { Input } from "../../ui/input.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Textarea } from "../../ui/textarea.js";
import { EditorFooter } from "../shared/editor-footer.js";
import { entryHref } from "../shared/entry-href.js";
import { formatDateTime } from "../shared/format-date.js";
import { SidePanelHeader } from "../shared/side-panel.js";
import { useDraftEditor } from "../shared/use-draft-editor.js";
import { copyText, mediaUsages, splitFilename, stemProblem, usageCount, usageNoteLabel, withExtension, } from "./media-item.js";
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
function folderPath(folder, folders) {
    const parts = [folder.name];
    let curr = folder;
    while (curr.parentId) {
        const parent = folders.find((f) => f.id === curr.parentId);
        if (!parent)
            break;
        parts.unshift(parent.name);
        curr = parent;
    }
    return parts.join(" / ");
}
/**
 * Media detail. Opens on the right whichever view (grid or list) it was picked from.
 * From the top: preview -> immediate actions (copy URL/ID, open) -> info -> default description (images) -> usages -> delete.
 * The file name (its stem; the extension stays) and the default description are inputs with an AI button beside them (file name, alt text, caption
 * suggestions). A suggestion only fills the input. The name is saved by its own button and the default description by pressing `Save`;
 * unsaved changes are reported through `onDirtyChange` (used to ask before opening or closing another file).
 */
export function MediaDetailPanel({ media, folders, className, onClose, onSaveDefaults, onRename, onMoveFolder, onRequestDelete, onDirtyChange, }) {
    const site = useSite();
    const t = useTranslator(mediaMessages);
    const tc = useTranslator(commonMessages);
    const [movingFolder, setMovingFolder] = useState(false);
    const altId = useId();
    const captionId = useId();
    // The last saved (initially loaded) value. If the edited value differs, there are unsaved changes.
    const [saved, setSaved] = useState({ alt: media.defaultAlt, caption: media.defaultCaption });
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const isImage = site.api.isImageMime(media.mimeType);
    const { draft, update: setDraft, dirty } = useDraftEditor({ saved, empty: saved, saving: isSaving });
    // The file name is edited as its stem; the extension stays. After a rename the draft starts from the new name.
    const { stem: savedStem, extension } = splitFilename(media.filename);
    const [stem, setStem] = useState(savedStem);
    const [renaming, setRenaming] = useState(false);
    const [renameError, setRenameError] = useState(null);
    const [prevSavedStem, setPrevSavedStem] = useState(savedStem);
    if (prevSavedStem !== savedStem) {
        setPrevSavedStem(savedStem);
        setStem(savedStem);
    }
    const nameDirty = stem !== savedStem;
    const problem = stemProblem(stem);
    const nameFieldId = useId();
    const nameErrorId = useId();
    // Both forms report to the parent as one: leaving with either one unsaved asks first.
    const anyDirty = dirty || nameDirty;
    useEffect(() => onDirtyChange?.(anyDirty), [anyDirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    const saveName = async () => {
        if (!nameDirty || problem)
            return;
        setRenaming(true);
        setRenameError(null);
        try {
            await onRename(`${stem.trim()}${extension}`);
        }
        catch (error) {
            setRenameError(errorText(site, error, t("library.renameFailed")));
        }
        finally {
            setRenaming(false);
        }
    };
    const saveDefaults = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSaveDefaults(draft);
            setSaved(draft);
        }
        catch (error) {
            setSaveError(errorText(site, error, tc("saveFailed")));
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
            current: target === "filename" ? `${stem}${extension}` : target === "defaultAlt" ? draft.alt : draft.caption,
        }),
        apply,
    });
    return (_jsxs("aside", { "aria-label": t("detail.label"), className: cn("flex h-full flex-col border-l bg-cms-background text-xs", className), children: [_jsx(SidePanelHeader, { title: media.filename, onClose: onClose }), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto", children: [_jsxs("div", { className: "space-y-3 p-4", children: [_jsx("div", { className: "flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-cms-muted/50", children: isImage && media.publicUrl ? (_jsx("img", { src: media.publicUrl, alt: "", className: "max-h-full max-w-full object-contain" })) : (_jsxs("span", { className: "flex flex-col items-center gap-2 text-cms-muted-foreground", children: [_jsx(MediaThumb, { media: media, iconClassName: "size-12" }), _jsx("span", { className: "font-medium", children: fileTypeLabel(media.filename, media.mimeType) })] })) }), _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [media.publicUrl && (_jsxs(_Fragment, { children: [_jsxs(Button, { type: "button", variant: "outline", size: "xs", onClick: () => void copyText(media.publicUrl, t("detail.copiedUrl"), tc("copyFailed")), children: [_jsx(Copy, { "aria-hidden": true }), t("detail.copyUrl")] }), _jsxs("a", { href: media.publicUrl, target: "_blank", rel: "noopener noreferrer", className: buttonVariants({ variant: "outline", size: "xs" }), children: [_jsx(ExternalLink, { "aria-hidden": true }), tc("open")] })] })), _jsxs(Button, { type: "button", variant: "outline", size: "xs", "aria-label": t("detail.copyIdLabel"), onClick: () => void copyText(media.id, t("detail.copiedId"), tc("copyFailed")), children: [_jsx(Copy, { "aria-hidden": true }), t("detail.copyId")] })] })] }), _jsx(Section, { title: t("detail.section.info"), children: _jsxs("dl", { className: "space-y-3", children: [_jsx(SlotScope, { request: slot("filename", (suggestion) => {
                                        // A suggestion comes without the extension; one that carries it is kept as is.
                                        setStem(splitFilename(withExtension(suggestion, media.filename)).stem);
                                        setRenameError(null);
                                    }), children: ({ trigger, panel }) => (_jsxs("form", { className: "space-y-1", onSubmit: (event) => {
                                            event.preventDefault();
                                            void saveName();
                                        }, children: [_jsxs(Field, { "data-invalid": problem && nameDirty ? true : undefined, children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx(FieldLabel, { htmlFor: nameFieldId, children: t("detail.row.filename") }), isImage && trigger] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Input, { id: nameFieldId, value: stem, disabled: renaming || media.status !== "ready", "aria-invalid": (problem !== null && nameDirty) || renameError !== null || undefined, "aria-describedby": renameError || (problem && nameDirty) ? nameErrorId : undefined, onChange: (event) => {
                                                                    setStem(event.target.value);
                                                                    setRenameError(null);
                                                                }, className: "h-8 min-w-0 flex-1 text-xs md:text-xs" }), extension && (_jsx("span", { className: "shrink-0 text-cms-muted-foreground", title: t("detail.filename.extensionKept"), children: extension })), _jsx(IconButton, { type: "submit", label: t("detail.filename.save"), size: "icon-sm", variant: "outline", disabled: !nameDirty || problem !== null || renaming, children: _jsx(Check, { "aria-hidden": true }) })] }), (renameError || (problem && nameDirty)) && (_jsx(FieldError, { id: nameErrorId, children: renameError ??
                                                            (problem === "empty" ? t("detail.filename.empty") : t("detail.filename.invalid")) }))] }), panel] })) }, `filename-${media.id}`), _jsx(Row, { label: t("detail.row.type"), children: isImage ? (media.mimeType ?? "—") : fileTypeLabel(media.filename, media.mimeType) }), isImage ? (_jsxs(Row, { label: t("detail.row.public"), children: [media.width, "\u00D7", media.height, " \u00B7 ", formatBytes(media.byteSize ?? 0)] })) : (_jsx(Row, { label: t("detail.row.size"), children: formatFileSize(media.byteSize ?? 0) })), isImage && media.original && (_jsxs(Row, { label: t("detail.row.original"), children: [media.original.width, "\u00D7", media.original.height, " \u00B7 ", formatBytes(media.original.byteSize ?? 0), " \u00B7", " ", media.original.mimeType] })), folders && (_jsx(Row, { label: t("detail.row.folder"), children: _jsxs(Select, { value: media.folderId ?? "root", disabled: movingFolder || !onMoveFolder, onValueChange: (val) => {
                                            if (!onMoveFolder)
                                                return;
                                            const nextId = val === "root" ? null : val;
                                            if (nextId === (media.folderId ?? null))
                                                return;
                                            setMovingFolder(true);
                                            void onMoveFolder(nextId).finally(() => setMovingFolder(false));
                                        }, children: [_jsx(SelectTrigger, { className: "h-8 text-xs", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "root", children: t("detail.folder.none") }), folders.map((f) => (_jsx(SelectItem, { value: f.id, children: folderPath(f, folders) }, f.id)))] })] }) })), _jsx(Row, { label: t("detail.row.uploadedAt"), children: formatDateTime(site, media.createdAt) }), _jsx(Row, { label: t("detail.row.id"), children: _jsx("code", { className: "text-[11px]", children: media.id }) })] }) }), isImage && (_jsxs(Section, { title: t("detail.section.defaults"), children: [_jsx("p", { className: "text-cms-muted-foreground", children: t("detail.defaultsHelp") }), _jsxs("form", { className: "space-y-3", onSubmit: (event) => {
                                    event.preventDefault();
                                    void saveDefaults();
                                }, children: [_jsx(SlotScope, { request: slot("defaultAlt", (alt) => setDraft({ alt })), children: ({ trigger, panel }) => (_jsxs(Field, { children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx(FieldLabel, { htmlFor: altId, children: t("detail.defaultAlt") }), trigger] }), _jsx(Textarea, { id: altId, rows: 2, value: draft.alt, disabled: isSaving, onChange: (event) => setDraft({ alt: event.target.value }), className: "min-h-14 text-xs md:text-xs" }), panel] })) }, `alt-${media.id}`), _jsx(SlotScope, { request: slot("defaultCaption", (caption) => setDraft({ caption })), children: ({ trigger, panel }) => (_jsxs(Field, { children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx(FieldLabel, { htmlFor: captionId, children: t("detail.defaultCaption") }), trigger] }), _jsx(Textarea, { id: captionId, rows: 2, value: draft.caption, disabled: isSaving, onChange: (event) => setDraft({ caption: event.target.value }), className: "min-h-14 text-xs md:text-xs" }), panel] })) }, `caption-${media.id}`), _jsx(EditorFooter, { dirty: dirty, saving: isSaving, canSave: media.status === "ready", error: saveError, align: "end" })] })] })), _jsx(Section, { title: t("detail.section.usage", { count: usageCount(media) }), children: media.referencesCount === 0 ? (_jsx("p", { className: "text-cms-muted-foreground", children: t("detail.noUsage") })) : (_jsx("ul", { className: "space-y-1", children: mediaUsages(media).map((usage) => (_jsx("li", { children: _jsxs("a", { href: withBasePath(entryHref(site, usage.collection, usage.entryId)), className: "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-cms-accent", children: [_jsx("span", { className: "min-w-0 flex-1 truncate", children: usage.title || tc("untitled") }), usage.note && (_jsx("span", { className: "shrink-0 text-cms-muted-foreground text-xs", children: usageNoteLabel(t, usage.note) }))] }) }, usage.entryId))) })) })] }), _jsxs("div", { className: "shrink-0 space-y-1.5 border-t px-4 py-3", children: [_jsx(Button, { type: "button", variant: "destructive", size: "sm", className: "w-full", disabled: media.referencesCount > 0, onClick: onRequestDelete, children: media.status === "deleting" ? t("detail.retryDelete") : tc("delete") }), media.referencesCount > 0 && (_jsx("p", { className: "text-center text-[11px] text-cms-muted-foreground", children: t("detail.inUse") }))] })] }));
}
