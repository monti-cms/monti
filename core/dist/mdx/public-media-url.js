import { getCmsContentStore, getCmsMediaStore } from "../container.js";
/**
 * Public URL of one media item (shared image etc.). `null` if it is not ready or the deployment has no DB or storage.
 */
export async function resolvePublicMediaUrl(mediaId) {
    try {
        const media = await getCmsContentStore().getMediaAsset(mediaId);
        if (!media || media.status !== "ready" || !media.storageKey)
            return null;
        const url = getCmsMediaStore().getPublicUrl(media.storageKey);
        return media.width && media.height ? { url, width: media.width, height: media.height } : { url };
    }
    catch {
        return null;
    }
}
