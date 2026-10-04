import { cmsApiUrl, createTranslator, fileTypeFor, MAX_FILE_BYTES } from "@monti-cms/core/client";
import { cmsApiErrorMessage } from "../screens/api-error-message.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
/** Default optimization policy. Can be changed in code. */
export const DEFAULT_OPTIMIZE_POLICY = {
    formats: ["image/jpeg", "image/png", "image/webp"],
    maxEdge: 2560,
    quality: 0.9,
    outputType: "image/webp",
    rename: (name) => `${name.replace(/\.[^.]+$/, "") || "image"}.webp`,
};
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
export async function prepareUpload(file, options = { optimize: false }) {
    if (!options.optimize)
        return { file, optimized: false };
    const policy = options.policy ?? DEFAULT_OPTIMIZE_POLICY;
    if (!policy.formats.includes(file.type)) {
        return { file, optimized: false, skippedReason: t("upload.keepFormat") };
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
function putFile(ticket, file, onProgress) {
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
const errorMessage = async (response, fallback) => cmsApiErrorMessage(await response.json().catch(() => null), fallback);
export async function uploadImageFile(input, onProgress) {
    const prepared = input instanceof File ? { file: input, optimized: false } : input;
    const { file, original } = prepared;
    const prepareRes = await fetch(cmsApiUrl("/v1/media/uploads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: original?.name ?? file.name,
            mimeType: file.type,
            byteSize: file.size,
            ...(original ? { original: { mimeType: original.type, byteSize: original.size } } : {}),
        }),
    });
    if (!prepareRes.ok)
        throw new Error(await errorMessage(prepareRes, t("upload.prepareFailed")));
    const ticket = (await prepareRes.json());
    const total = file.size + (original?.size ?? 0);
    let publicLoaded = 0;
    let originalLoaded = 0;
    const report = () => onProgress?.(Math.round(((publicLoaded + originalLoaded) / total) * 100));
    await Promise.all([
        putFile(ticket, file, (loaded) => {
            publicLoaded = loaded;
            report();
        }),
        original && ticket.original
            ? putFile(ticket.original, original, (loaded) => {
                originalLoaded = loaded;
                report();
            })
            : Promise.resolve(),
    ]);
    const completeRes = await fetch(cmsApiUrl(`/v1/media/${ticket.mediaId}/complete`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
    });
    if (!completeRes.ok)
        throw new Error(await errorMessage(completeRes, t("upload.completeFailed")));
    const result = await completeRes.json();
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
export async function uploadAttachment(file, onProgress) {
    const mimeType = fileTypeFor(file.name);
    if (!mimeType)
        throw new Error(t("upload.unsupportedType"));
    if (file.size > MAX_FILE_BYTES)
        throw new Error(t("upload.tooLarge", { mb: MAX_FILE_BYTES / 1024 / 1024 }));
    const typed = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
    const uploaded = await uploadImageFile(typed, onProgress);
    return { mediaId: uploaded.mediaId };
}
