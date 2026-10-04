import { randomUUID } from "node:crypto";
import { getCmsContentStore, getCmsMediaStore } from "../../../../../container.js";
import { isImageMime } from "../../../../../core/api.js";
import { HttpError } from "../../../error-handler.js";
import { adminRoute, json } from "../../../handler.js";
import { attachmentDisposition, extensionFor, inspectUploadedFile } from "../../media-files.js";
/**
 * Upload completion check. Marks the media `ready` only after the server inspects the stored file.
 * If the check fails, the media does not become usable and stays `failed`, to be cleaned up.
 */
export const POST = adminRoute(async ({ params }) => {
    const store = getCmsContentStore();
    const media = await store.getMediaAsset(params.id);
    if (!media)
        throw new HttpError(404, "not_found", "Media asset not found");
    const mediaStore = getCmsMediaStore();
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
        return json(describe(media));
    if (media.status !== "pending" || !media.stagingKey) {
        throw new HttpError(409, "upload_incomplete", `Media asset cannot be completed in status: ${media.status}`);
    }
    let file;
    let original = null;
    try {
        file = await inspectUploadedFile(mediaStore, media.stagingKey, media.mimeType);
        if (media.original?.stagingKey)
            original = await inspectUploadedFile(mediaStore, media.original.stagingKey);
    }
    catch (error) {
        // If the file is not there yet, leave it as is so it can be retried. A file that fails inspection cannot be used.
        if (!(error instanceof HttpError) || error.code !== "upload_incomplete")
            await store.failMediaAsset(params.id);
        throw error;
    }
    const finalKey = `media/${params.id}/${randomUUID()}.${extensionFor(file.detected.mimeType)}`;
    await mediaStore.promoteFile({
        stagingKey: media.stagingKey,
        finalKey,
        expectedEtag: file.head.etag,
        contentType: file.detected.mimeType,
        // Attachments download under their original name. Images display directly in the browser.
        ...(isImageMime(file.detected.mimeType) ? {} : { contentDisposition: attachmentDisposition(media.filename) }),
    });
    let originalKey = null;
    if (original && media.original?.stagingKey) {
        originalKey = `media/${params.id}/original-${randomUUID()}.${extensionFor(original.detected.mimeType)}`;
        await mediaStore.promoteFile({
            stagingKey: media.original.stagingKey,
            finalKey: originalKey,
            expectedEtag: original.head.etag,
            contentType: original.detected.mimeType,
        });
    }
    const updated = await store.completeMediaAsset({
        id: params.id,
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
    return json(describe(updated));
});
