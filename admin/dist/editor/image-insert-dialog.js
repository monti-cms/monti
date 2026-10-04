"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, createTranslator } from "@monti-cms/core/client";
import { useEffect, useId, useState } from "react";
import { cn } from "../lib/utils/cn.js";
import { MEDIA_NOT_CONFIGURED } from "../screens/api-error-message.js";
import { useAdminFeatures } from "../screens/shared/admin-features.js";
import { Alert, AlertDescription } from "../ui/alert.js";
import { Button } from "../ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { Skeleton } from "../ui/skeleton.js";
import { Spinner } from "../ui/spinner.js";
import { Switch } from "../ui/switch.js";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs.js";
import { Textarea } from "../ui/textarea.js";
import { submitOnEnter } from "./link-form.js";
import { editorMessages } from "./messages.js";
import { formatBytes, prepareUpload, uploadImageFile } from "./upload-helper.js";
const t = createTranslator(editorMessages);
/** Notice for when an image that needs a description has no alt text. Shared by the insert dialog and image settings. */
export const ALT_REQUIRED_MESSAGE = t("imageDialog.altRequired");
/**
 * Image insertion. Upload a new file (original kept by default, web optimization optional) or reuse from the library.
 * The library's default alt and caption are copied on insertion. An image that needs a description must have alt.
 */
export function ImageInsertDialog({ open, initialFile, onClose, onInsert, mode = "insert", title = t("imageDialog.title"), }) {
    const picking = mode === "pick";
    const { media } = useAdminFeatures();
    const altId = useId();
    const altErrorId = useId();
    const captionId = useId();
    const searchId = useId();
    const optimizeId = useId();
    const decorativeId = useId();
    const [tab, setTab] = useState("upload");
    const [file, setFile] = useState(null);
    const [optimize, setOptimize] = useState(false);
    const [prepared, setPrepared] = useState(null);
    const [picked, setPicked] = useState(null);
    const [alt, setAlt] = useState("");
    const [caption, setCaption] = useState("");
    const [decorative, setDecorative] = useState(false);
    /** Show an empty alt text as an error once the alt field was touched or insert was pressed. */
    const [altTouched, setAltTouched] = useState(false);
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [library, setLibrary] = useState([]);
    const [isLibraryLoading, setIsLibraryLoading] = useState(false);
    const [libraryFailed, setLibraryFailed] = useState(false);
    const [libraryAttempt, setLibraryAttempt] = useState(0);
    useEffect(() => {
        if (!open)
            return;
        setTab(initialFile ? "upload" : "upload");
        setFile(initialFile);
        setOptimize(false);
        setPrepared(null);
        setPicked(null);
        setAlt("");
        setCaption("");
        setDecorative(false);
        setAltTouched(false);
        setProgress(null);
        setError(null);
    }, [open, initialFile]);
    useEffect(() => {
        let cancelled = false;
        if (!file) {
            setPrepared(null);
            return;
        }
        prepareUpload(file, { optimize }).then((result) => {
            if (!cancelled)
                setPrepared(result);
        });
        return () => {
            cancelled = true;
        };
    }, [file, optimize]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: libraryAttempt is re-read on retry
    useEffect(() => {
        if (!open || tab !== "library")
            return;
        let cancelled = false;
        setIsLibraryLoading(true);
        setLibraryFailed(false);
        const timer = setTimeout(() => {
            const params = new URLSearchParams({ pageSize: "24", kind: "image" });
            if (search.trim())
                params.set("search", search.trim());
            fetch(cmsApiUrl(`/v1/media?${params.toString()}`))
                .then((res) => {
                if (!res.ok)
                    throw new Error(String(res.status));
                return res.json();
            })
                .then((data) => {
                if (!cancelled)
                    setLibrary((data.items ?? []).filter((item) => item.status !== "deleting"));
            })
                .catch(() => {
                if (cancelled)
                    return;
                setLibrary([]);
                setLibraryFailed(true);
            })
                .finally(() => {
                if (!cancelled)
                    setIsLibraryLoading(false);
            });
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [open, tab, search, libraryAttempt]);
    const isUploading = progress !== null;
    const needsAlt = !picking && !decorative && !alt.trim();
    const hasImage = tab === "upload" ? Boolean(prepared) : Boolean(picked);
    const canInsert = !isUploading && !needsAlt && hasImage;
    const showAltError = needsAlt && altTouched;
    const pick = (item) => {
        setPicked(item);
        setAlt(item.defaultAlt);
        setCaption(item.defaultCaption);
        setDecorative(false);
    };
    const confirm = async (event) => {
        event?.preventDefault();
        if (needsAlt && hasImage)
            setAltTouched(true);
        if (!canInsert)
            return;
        setError(null);
        if (tab === "library" && picked) {
            onInsert({
                mediaId: picked.id,
                alt: decorative ? "" : alt.trim(),
                decorative,
                caption: caption.trim(),
                publicUrl: picked.publicUrl,
            });
            return;
        }
        if (!prepared)
            return;
        setProgress(0);
        try {
            const uploaded = await uploadImageFile(prepared, setProgress);
            onInsert({
                mediaId: uploaded.mediaId,
                alt: decorative ? "" : alt.trim(),
                decorative,
                caption: caption.trim(),
                publicUrl: uploaded.publicUrl,
            });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t("imageDialog.uploadFailed"));
        }
        finally {
            setProgress(null);
        }
    };
    if (!media) {
        return (_jsx(Dialog, { open: open, onOpenChange: (next) => !next && onClose(), children: _jsxs(DialogContent, { className: "max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), _jsx(DialogDescription, { children: MEDIA_NOT_CONFIGURED })] }), _jsx(DialogFooter, { children: _jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t("imageDialog.close") }) })] }) }));
    }
    return (_jsx(Dialog, { open: open, onOpenChange: (next) => !next && !isUploading && onClose(), children: _jsx(DialogContent, { className: "max-w-lg", showCloseButton: !isUploading, children: _jsxs("form", { onSubmit: (event) => void confirm(event), 
                // Do not insert with the Enter that ends Korean composition. Enter also inserts in multi-line fields (Shift+Enter is a line break).
                onKeyDown: submitOnEnter, className: "contents", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), _jsx(DialogDescription, { children: t("imageDialog.description") })] }), _jsx(Tabs, { value: tab, onValueChange: (value) => setTab(value), children: _jsxs(TabsList, { variant: "line", "aria-label": t("imageDialog.sourceLabel"), children: [_jsx(TabsTrigger, { value: "upload", disabled: isUploading, children: t("imageDialog.upload") }), _jsx(TabsTrigger, { value: "library", disabled: isUploading, children: t("imageDialog.library") })] }) }), tab === "upload" ? (_jsxs("div", { className: "space-y-2 text-sm", children: [_jsx(Input, { type: "file", "aria-label": t("imageDialog.fileLabel"), accept: "image/jpeg,image/png,image/webp,image/gif,image/avif", disabled: isUploading, onChange: (event) => setFile(event.target.files?.[0] ?? null) }), file && (_jsxs(_Fragment, { children: [_jsxs(Label, { htmlFor: optimizeId, className: "font-normal", children: [_jsx(Switch, { id: optimizeId, checked: optimize, disabled: isUploading, onCheckedChange: (checked) => setOptimize(checked) }), t("imageDialog.optimize")] }), _jsx("p", { className: "text-cms-muted-foreground text-xs", "aria-live": "polite", children: prepared?.optimized
                                            ? `WebP · ${formatBytes(file.size)} → ${formatBytes(prepared.file.size)} · ${prepared.width}×${prepared.height}`
                                            : `${t("imageDialog.keepOriginal", { size: formatBytes(file.size) })}${prepared?.skippedReason ? ` · ${prepared.skippedReason}` : ""}` })] }))] })) : (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: searchId, className: "sr-only", children: t("imageDialog.search") }), _jsx(Input, { id: searchId, value: search, placeholder: t("imageDialog.search"), onChange: (event) => setSearch(event.target.value) }), _jsxs("div", { className: "grid max-h-64 grid-cols-3 gap-2 overflow-y-auto", "aria-busy": isLibraryLoading, children: [isLibraryLoading &&
                                        library.length === 0 &&
                                        ["a", "b", "c"].map((key) => _jsx(Skeleton, { className: "h-[6.25rem] w-full rounded-md" }, key)), libraryFailed && !isLibraryLoading && (_jsx(Alert, { variant: "danger", className: "col-span-3", children: _jsxs(AlertDescription, { className: "flex items-center justify-between gap-2", children: [t("imageDialog.libraryFailed"), _jsx(Button, { type: "button", size: "xs", variant: "outline", onClick: () => setLibraryAttempt((n) => n + 1), children: t("imageDialog.retry") })] }) })), library.length === 0 && !isLibraryLoading && !libraryFailed && (_jsx("p", { className: "col-span-3 py-6 text-center text-cms-muted-foreground text-sm", children: t("imageDialog.libraryEmpty") })), library.map((item) => (_jsxs(Button, { type: "button", variant: "outline", "aria-pressed": picked?.id === item.id, onClick: () => pick(item), className: cn("h-auto flex-col items-stretch gap-0 overflow-hidden p-0 text-left font-normal text-xs", picked?.id === item.id && "ring-2 ring-cms-primary"), children: [item.publicUrl ? (_jsx("img", { src: item.publicUrl, alt: "", className: "h-20 w-full object-cover" })) : (_jsx("span", { className: "flex h-20 items-center justify-center bg-cms-muted", children: t("imageDialog.noPreview") })), _jsx("span", { className: "block truncate px-1 py-0.5", children: item.filename })] }, item.id)))] })] })), _jsxs("div", { className: cn("space-y-2 text-sm", picking && "hidden"), children: [_jsx(Label, { htmlFor: altId, children: t("imageDialog.alt") }), _jsx(Textarea, { id: altId, value: alt, rows: 2, disabled: decorative || isUploading, "aria-required": !decorative, "aria-invalid": showAltError || undefined, "aria-describedby": showAltError ? altErrorId : undefined, onChange: (event) => {
                                    setAlt(event.target.value);
                                    setAltTouched(true);
                                }, onBlur: () => setAltTouched(true), className: "min-h-0" }), showAltError && (_jsx("p", { id: altErrorId, role: "alert", className: "text-cms-destructive text-xs", children: ALT_REQUIRED_MESSAGE })), _jsxs(Label, { htmlFor: decorativeId, className: "font-normal", children: [_jsx(Switch, { id: decorativeId, checked: decorative, disabled: isUploading, onCheckedChange: (checked) => setDecorative(checked) }), t("imageDialog.decorative")] }), _jsx(Label, { htmlFor: captionId, children: t("imageDialog.caption") }), _jsx(Textarea, { id: captionId, value: caption, rows: 2, disabled: isUploading, onChange: (event) => setCaption(event.target.value), className: "min-h-0" })] }), isUploading && (_jsxs("output", { className: "flex items-center gap-2 text-sm", children: [_jsx(Spinner, {}), " ", t("imageDialog.uploading", { percent: progress ?? 0 })] })), error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-sm", children: error })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", disabled: isUploading, onClick: onClose, children: t("imageDialog.cancel") }), _jsx(Button, { type: "submit", disabled: isUploading || !hasImage, children: tab === "upload"
                                    ? error
                                        ? t("imageDialog.reupload")
                                        : picking
                                            ? t("imageDialog.upload")
                                            : t("imageDialog.insert")
                                    : picking
                                        ? t("imageDialog.pick")
                                        : t("imageDialog.insert") })] })] }) }) }));
}
