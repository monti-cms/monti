"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, FILE_ACCEPT } from "@monti-cms/core/client";
import { FileIcon, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ImageInsertDialog } from "../../editor/image-insert-dialog.js";
import { uploadAttachment } from "../../editor/upload-helper.js";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { cmsFetch } from "../admin-api.js";
import { t } from "./translate.js";
/** Media ID -> public URL. Shared by the input and the extension's preview. `null` if it cannot be loaded. */
const urls = new Map();
const loading = new Set();
const listeners = new Set();
const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
/** Remembers the URL of the picked image. It is not fetched again. */
export function rememberMediaUrl(mediaId, url) {
    urls.set(mediaId, url);
    for (const listener of listeners)
        listener();
}
/** Public URL of a media ID. `null` if empty, not yet known, or failed to load. */
export function useMediaUrl(mediaId) {
    const url = useSyncExternalStore(subscribe, () => (mediaId ? urls.get(mediaId) : undefined), () => undefined);
    useEffect(() => {
        if (!mediaId || urls.has(mediaId) || loading.has(mediaId))
            return;
        loading.add(mediaId);
        cmsFetch(cmsApiUrl(`/v1/media/${mediaId}`))
            .then((media) => rememberMediaUrl(mediaId, media.publicUrl))
            .catch(() => rememberMediaUrl(mediaId, null))
            .finally(() => loading.delete(mediaId));
    }, [mediaId]);
    return mediaId ? (url ?? null) : null;
}
/** Image preview. Shows an icon if the URL is unknown. */
export function MediaThumbnail({ mediaId, className }) {
    const url = useMediaUrl(mediaId);
    return url ? (_jsx("img", { src: url, alt: "", className: cn("object-cover", className) })) : (_jsx("div", { className: cn("flex items-center justify-center bg-cms-muted text-cms-muted-foreground", className), children: _jsx(ImageIcon, { "aria-hidden": true, className: "size-4" }) }));
}
/** Default input of a media field (`fields.media`). Picks a file if `accept` is `file`, otherwise an image. */
export function MediaInput(props) {
    return props.field.kind === "media" && props.field.accept === "file" ? (_jsx(MediaFileInput, { ...props })) : (_jsx(MediaImageInput, { ...props }));
}
/** Picks an image from the media library and shows the picked image small. */
export function MediaImageInput({ field, id, value, invalid, describedBy, context, onChange }) {
    const [picking, setPicking] = useState(false);
    const mediaId = typeof value === "string" ? value : "";
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [mediaId && _jsx(MediaThumbnail, { mediaId: mediaId, className: "aspect-[1.91/1] h-7 shrink-0 rounded border" }), _jsx(Button, { id: id, type: "button", size: "sm", variant: "outline", className: "h-7 flex-1 text-xs", disabled: context.disabled, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, onClick: () => setPicking(true), children: mediaId ? t("media.change") : t("media.chooseImage") }), mediaId && (_jsx(Button, { type: "button", size: "sm", variant: "ghost", className: "h-7 text-xs", disabled: context.disabled, onClick: () => onChange(""), children: t("media.remove") }))] }), _jsx(ImageInsertDialog, { open: picking, initialFile: null, mode: "pick", title: field.label, onClose: () => setPicking(false), onInsert: (image) => {
                    rememberMediaUrl(image.mediaId, image.publicUrl);
                    onChange(image.mediaId);
                    setPicking(false);
                } })] }));
}
/** Uploads and picks one file. The picked file is shown by its file name. */
function MediaFileInput({ id, value, invalid, describedBy, context, onChange }) {
    const mediaId = typeof value === "string" ? value : "";
    const fileInput = useRef(null);
    const [filename, setFilename] = useState(null);
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        setFilename(null);
        if (!mediaId)
            return;
        let cancelled = false;
        cmsFetch(cmsApiUrl(`/v1/media/${mediaId}`))
            .then((media) => !cancelled && setFilename(media.filename ?? null))
            .catch(() => { });
        return () => {
            cancelled = true;
        };
    }, [mediaId]);
    const upload = async (file) => {
        setError(null);
        setProgress(0);
        try {
            const uploaded = await uploadAttachment(file, setProgress);
            setFilename(file.name);
            onChange(uploaded.mediaId);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : t("media.uploadFailed"));
        }
        finally {
            setProgress(null);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [mediaId && (_jsxs("span", { className: "flex min-w-0 flex-1 items-center gap-1 text-xs", children: [_jsx(FileIcon, { "aria-hidden": true, className: "size-3.5 shrink-0 text-cms-muted-foreground" }), _jsx("span", { className: "truncate", children: filename ?? mediaId })] })), _jsx(Button, { id: id, type: "button", size: "sm", variant: "outline", className: cn("h-7 text-xs", !mediaId && "flex-1"), disabled: context.disabled || progress !== null, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, onClick: () => fileInput.current?.click(), children: progress !== null ? t("media.uploading", { progress }) : mediaId ? t("media.change") : t("media.chooseFile") }), mediaId && (_jsx(Button, { type: "button", size: "sm", variant: "ghost", className: "h-7 text-xs", disabled: context.disabled, onClick: () => onChange(""), children: t("media.remove") }))] }), _jsx("input", { ref: fileInput, type: "file", accept: FILE_ACCEPT, hidden: true, "aria-hidden": true, tabIndex: -1, onChange: (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file)
                        void upload(file);
                } }), error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: error }))] }));
}
