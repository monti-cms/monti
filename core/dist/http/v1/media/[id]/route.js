import { getCmsContentStore, getCmsMediaStore } from "../../../../container.js";
import { mediaPatchBodySchema } from "../../../../core/api.js";
import { HttpError } from "../../error-handler.js";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler.js";
/** Media detail. Also used when the editor shows an image from `mediaId` alone (including a check of the stored file). */
export const GET = adminRoute(async ({ params }) => {
    const media = await getCmsContentStore().getMediaAsset(params.id);
    if (!media)
        throw new HttpError(404, "not_found", "Media asset not found");
    if (media.status !== "ready" || !media.storageKey) {
        return json({ ...media, mediaId: media.id, publicUrl: null });
    }
    const mediaStore = getCmsMediaStore();
    const head = await mediaStore.headFile({ key: media.storageKey });
    return json({
        ...media,
        mediaId: media.id,
        status: head ? "ready" : "missing",
        publicUrl: head ? mediaStore.getPublicUrl(media.storageKey) : null,
        originalUrl: media.original?.storageKey ? mediaStore.getPublicUrl(media.original.storageKey) : null,
    });
});
/** Edits the default alt and caption. Bodies already written do not change. */
export const PATCH = adminRoute(async ({ request, params }) => {
    const body = parseWith(mediaPatchBodySchema, await readJsonBody(request));
    return json(await getCmsContentStore().updateMediaMetadata({ id: params.id, ...body }));
});
/**
 * Deletes only unused files. Marks the row `deleting`, deletes the file, and removes the row on success.
 * If storage deletion fails, the `deleting` row stays and can be retried.
 */
export const DELETE = adminRoute(async ({ params }) => {
    const store = getCmsContentStore();
    const media = await store.beginMediaDelete(params.id);
    const mediaStore = getCmsMediaStore();
    const keys = [media.storageKey, media.stagingKey, media.original?.storageKey, media.original?.stagingKey];
    for (const key of keys) {
        if (key)
            await mediaStore.deleteFile({ key });
    }
    await store.finalizeMediaDelete(params.id);
    return json({ success: true, id: params.id });
});
