import { NoticeError } from "../api/client.js";
import { apiErrorMessages } from "../api/error-message.messages.js";
import { completeUpload, requestUpload } from "../api/media.js";
import { isSandboxSite } from "../screens/shared/preview-sandbox.js";
import { editorMessages } from "./messages.js";
/** Default optimization policy. Can be changed in code. */
export const DEFAULT_OPTIMIZE_POLICY = {
    formats: ["image/jpeg", "image/png", "image/webp"],
    maxEdge: 2560,
    quality: 0.9,
    outputType: "image/webp",
    rename: (name) => `${name.replace(/\.[^.]+$/, "") || "image"}.webp`,
};
/** `accept` value of an image file input: the image types this site allows. */
export const imageAccept = (site) => site.api.ALLOWED_IMAGE_MIME_TYPES.join(",");
const readBytes = (blob) => typeof blob.arrayBuffer === "function"
    ? blob.arrayBuffer()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
/** Whether the WebP has an animation chunk (`ANIM`). */
async function isAnimatedWebp(file) {
    const head = new Uint8Array(await readBytes(file.slice(0, 64 * 1024)));
    for (let i = 12; i < head.length - 4; i++) {
        if (head[i] === 0x41 && head[i + 1] === 0x4e && head[i + 2] === 0x49 && head[i + 3] === 0x4d)
            return true;
    }
    return false;
}
/**
 * Web optimization. If it cannot convert or conversion is not a gain, returns the original as is and records the reason.
 * Never silently turns an animation into a still image.
 */
export async function prepareUpload(site, file, options = { optimize: false }) {
    const t = site.createTranslator(editorMessages);
    if (!options.optimize)
        return { file, optimized: false };
    const policy = options.policy ?? DEFAULT_OPTIMIZE_POLICY;
    if (!policy.formats.includes(file.type)) {
        return { file, optimized: false, skippedReason: t("upload.keepFormat") };
    }
    // Converting to a type the site does not allow would be refused by the server: keep the original instead.
    if (!site.api.isAllowedImage(policy.outputType)) {
        return { file, optimized: false, skippedReason: t("upload.outputNotAllowed") };
    }
    if (file.type === "image/webp" && (await isAnimatedWebp(file))) {
        return { file, optimized: false, skippedReason: t("upload.keepAnimated") };
    }
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
        return { file, optimized: false, skippedReason: t("upload.noConvert") };
    }
    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
    }
    catch {
        return { file, optimized: false, skippedReason: t("upload.unreadable") };
    }
    const scale = Math.min(1, policy.maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, policy.outputType, policy.quality));
    // Browsers that do not support WebP encoding return PNG.
    if (!blob || blob.type !== policy.outputType) {
        return { file, optimized: false, skippedReason: t("upload.noWebp") };
    }
    if (scale === 1 && blob.size >= file.size) {
        return { file, optimized: false, skippedReason: t("upload.originalSmaller"), width, height };
    }
    return {
        file: new File([blob], policy.rename(file.name), { type: policy.outputType }),
        original: file,
        optimized: true,
        width,
        height,
    };
}
function putFile(site, ticket, file, onProgress) {
    const t = site.createTranslator(editorMessages);
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", ticket.uploadUrl, true);
        for (const [key, value] of Object.entries(ticket.requiredHeaders ?? {}))
            xhr.setRequestHeader(key, value);
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable)
                onProgress?.(event.loaded);
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(t("upload.storageFailed", { status: xhr.status })));
        xhr.onerror = () => reject(new Error(t("upload.networkError")));
        xhr.ontimeout = () => reject(new Error(t("upload.timeout")));
        xhr.send(file);
    });
}
/** Runs an admin API call of an upload step: a refused or failed call keeps its message, and being offline reads as the upload's network error. */
async function uploadCall(site, call) {
    try {
        return await call();
    }
    catch (error) {
        if (error instanceof TypeError)
            throw new NoticeError(site.createTranslator(editorMessages)("upload.networkError"));
        throw error;
    }
}
export async function uploadImageFile(site, input, onProgress, options) {
    const t = site.createTranslator(editorMessages);
    const prepared = input instanceof File ? { file: input, optimized: false } : input;
    const { file, original } = prepared;
    // Server stays the authority. This only spares the user an upload that would be refused.
    if (file.size > site.api.MAX_MEDIA_BYTES)
        throw new NoticeError(t("upload.tooLarge", { mb: site.api.MAX_MEDIA_BYTES / 1024 / 1024 }));
    // A preview of a screen runs on a draft site: nothing is uploaded from it (the storage PUT below included).
    if (isSandboxSite(site))
        throw new NoticeError(site.createTranslator(apiErrorMessages)("previewNoWrite"));
    const ticket = await uploadCall(site, () => requestUpload(site, {
        filename: original?.name ?? file.name,
        mimeType: file.type,
        byteSize: file.size,
        ...(options?.folderId ? { folderId: options.folderId } : {}),
        ...(original ? { original: { mimeType: original.type, byteSize: original.size } } : {}),
    }, t("upload.prepareFailed")));
    const total = file.size + (original?.size ?? 0);
    let publicLoaded = 0;
    let originalLoaded = 0;
    const report = () => onProgress?.(Math.round(((publicLoaded + originalLoaded) / total) * 100));
    await Promise.all([
        putFile(site, ticket, file, (loaded) => {
            publicLoaded = loaded;
            report();
        }),
        original && ticket.original
            ? putFile(site, ticket.original, original, (loaded) => {
                originalLoaded = loaded;
                report();
            })
            : Promise.resolve(),
    ]);
    const result = await uploadCall(site, () => completeUpload(site, ticket.mediaId, t("upload.completeFailed")));
    return {
        mediaId: result.mediaId,
        publicUrl: result.publicUrl ?? null,
        width: result.width,
        height: result.height,
        defaultAlt: result.defaultAlt ?? "",
        defaultCaption: result.defaultCaption ?? "",
    };
}
export const formatBytes = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
/**
 * Uploads an attachment file. The format is decided by the file name extension (browsers give inconsistent types for code files).
 * Rejects before uploading if the format is not accepted or the site setting limit (`media.maxFileBytes`) is exceeded.
 */
export async function uploadAttachment(site, file, onProgress, options) {
    const t = site.createTranslator(editorMessages);
    // A preview of a screen runs on a draft site: nothing is uploaded from it.
    if (isSandboxSite(site))
        throw new NoticeError(site.createTranslator(apiErrorMessages)("previewNoWrite"));
    const mimeType = site.api.fileTypeFor(file.name);
    if (!mimeType)
        throw new NoticeError(t("upload.unsupportedType"));
    if (file.size > site.api.MAX_FILE_BYTES)
        throw new NoticeError(t("upload.tooLarge", { mb: site.api.MAX_FILE_BYTES / 1024 / 1024 }));
    const typed = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
    const uploaded = await uploadImageFile(site, typed, onProgress, options);
    return { mediaId: uploaded.mediaId };
}
