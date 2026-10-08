import { randomUUID } from "node:crypto";
import { HttpError } from "../error-handler.js";
import { parseWith } from "../handler.js";
import { attachmentDisposition, extensionFor, inspectUploadedFile, UPLOAD_URL_TTL_SECONDS } from "./media-files.js";
/** The server decides the allowed type, size and file key. `raw` is the request body of `POST /media/uploads`. */
export async function prepareMediaUpload(cms, raw) {
    const input = raw;
    // §10.1: a disallowed file type is 415 (distinct from the 400 format error).
    const allowed = [
        ...cms.site.api.ALLOWED_IMAGE_MIME_TYPES,
        ...cms.site.api.ALLOWED_FILE_MIME_TYPES,
    ];
    if (input?.mimeType !== undefined && !allowed.includes(input.mimeType)) {
        throw new HttpError(415, "unsupported_media_type", `Allowed types: ${allowed.join(", ")}`);
    }
    const originalMime = input?.original?.mimeType;
    if (originalMime !== undefined &&
        !cms.site.api.ALLOWED_IMAGE_MIME_TYPES.includes(originalMime)) {
        throw new HttpError(415, "unsupported_media_type", `Allowed image types: ${cms.site.api.ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
    }
    const body = parseWith(cms.site.api.mediaUploadBodySchema, raw);
    const isFile = !cms.site.api.isImageMime(body.mimeType);
    // An attachment's type must match its filename extension. This stops type swaps such as sending a code file as text.
    if (isFile && cms.site.api.fileTypeFor(body.filename) !== body.mimeType) {
        throw new HttpError(415, "unsupported_media_type", `File extension does not match ${body.mimeType}`);
    }
    const originalFile = "original" in body ? body.original : undefined;
    const limit = isFile ? cms.site.api.MAX_FILE_BYTES : cms.site.api.MAX_MEDIA_BYTES;
    for (const file of [body, originalFile]) {
        if (file && file.byteSize > limit) {
            throw new HttpError(413, "payload_too_large", `File size exceeds the ${limit / 1024 / 1024}MiB limit (${file.byteSize} bytes)`);
        }
    }
    const mediaId = randomUUID();
    const stagingKey = `staging/${mediaId}/${randomUUID()}.${extensionFor(body.mimeType)}`;
    const originalStagingKey = originalFile
        ? `staging/${mediaId}/original-${randomUUID()}.${extensionFor(originalFile.mimeType)}`
        : null;
    await cms.store().createMediaAsset({
        id: mediaId,
        filename: body.filename,
        mimeType: body.mimeType,
        byteSize: body.byteSize,
        stagingKey,
        ...(originalFile && originalStagingKey
            ? {
                original: {
                    mimeType: originalFile.mimeType,
                    byteSize: originalFile.byteSize,
                    stagingKey: originalStagingKey,
                },
            }
            : {}),
    });
    const mediaStore = cms.mediaStore();
    const presigned = await mediaStore.prepareUpload({
        stagingKey,
        contentType: body.mimeType,
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });
    const original = originalFile && originalStagingKey
        ? await mediaStore.prepareUpload({
            stagingKey: originalStagingKey,
            contentType: originalFile.mimeType,
            expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
        })
        : null;
    const describe = (upload) => ({
        uploadUrl: upload.url,
        method: upload.method,
        requiredHeaders: upload.requiredHeaders,
        expiresAt: upload.expiresAt.toISOString(),
    });
    return { mediaId, ...describe(presigned), ...(original ? { original: describe(original) } : {}) };
}
/** Inspects the stored file by its bytes and promotes it. The asset is `ready` afterwards; a file that fails inspection leaves it `failed`. */
export async function completeMediaUpload(cms, mediaId) {
    const store = cms.store();
    const media = await store.getMediaAsset(mediaId);
    if (!media)
        throw new HttpError(404, "not_found", "Media asset not found");
    const mediaStore = cms.mediaStore();
    const describe = (record) => ({
        mediaId: record.id,
        status: "ready",
        publicUrl: record.storageKey ? mediaStore.getPublicUrl(record.storageKey) : null,
        width: record.width,
        height: record.height,
        byteSize: record.byteSize,
        mimeType: record.mimeType,
        defaultAlt: record.defaultAlt,
        defaultCaption: record.defaultCaption,
    });
    if (media.status === "ready")
        return describe(media);
    if (media.status !== "pending" || !media.stagingKey) {
        throw new HttpError(409, "upload_incomplete", `Media asset cannot be completed in status: ${media.status}`);
    }
    let file;
    let original = null;
    try {
        file = await inspectUploadedFile(cms.site, mediaStore, media.stagingKey, media.mimeType);
        if (media.original?.stagingKey)
            original = await inspectUploadedFile(cms.site, mediaStore, media.original.stagingKey);
    }
    catch (error) {
        // If the file is not there yet, leave it as is so it can be retried. A file that fails inspection cannot be used.
        if (!(error instanceof HttpError) || error.code !== "upload_incomplete")
            await store.failMediaAsset(mediaId);
        throw error;
    }
    const finalKey = `media/${mediaId}/${randomUUID()}.${extensionFor(file.detected.mimeType)}`;
    await mediaStore.promoteFile({
        stagingKey: media.stagingKey,
        finalKey,
        expectedEtag: file.head.etag,
        contentType: file.detected.mimeType,
        // Attachments download under their original name. Images display directly in the browser.
        ...(cms.site.api.isImageMime(file.detected.mimeType)
            ? {}
            : { contentDisposition: attachmentDisposition(media.filename) }),
    });
    let originalKey = null;
    if (original && media.original?.stagingKey) {
        originalKey = `media/${mediaId}/original-${randomUUID()}.${extensionFor(original.detected.mimeType)}`;
        await mediaStore.promoteFile({
            stagingKey: media.original.stagingKey,
            finalKey: originalKey,
            expectedEtag: original.head.etag,
            contentType: original.detected.mimeType,
        });
    }
    const updated = await store.completeMediaAsset({
        id: mediaId,
        storageKey: finalKey,
        mimeType: file.detected.mimeType,
        byteSize: file.head.contentLength,
        width: file.detected.width,
        height: file.detected.height,
        ...(original && originalKey
            ? {
                original: {
                    storageKey: originalKey,
                    mimeType: original.detected.mimeType,
                    byteSize: original.head.contentLength,
                    // The original is always an image, so it has dimensions.
                    width: original.detected.width ?? 0,
                    height: original.detected.height ?? 0,
                },
            }
            : {}),
    });
    return describe(updated);
}
