import { getCmsContentStore, getCmsMediaStore } from "../../../../container.js";
import { adminRoute, json } from "../../handler.js";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
/**
 * Cleans up incomplete or failed uploads older than 24 hours. No external cron is needed.
 * Items whose file deletion failed are kept and retried on the next cleanup.
 */
export const POST = adminRoute(async () => {
    const store = getCmsContentStore();
    const mediaStore = getCmsMediaStore();
    const stale = await store.listStaleUploads({ before: new Date(Date.now() - STALE_AFTER_MS) });
    let removed = 0;
    const failed = [];
    for (const media of stale) {
        try {
            for (const key of [media.stagingKey, media.original?.stagingKey]) {
                if (key)
                    await mediaStore.deleteFile({ key });
            }
            await store.finalizeMediaDelete(media.id);
            removed += 1;
        }
        catch {
            failed.push(media.id);
        }
    }
    return json({ removed, failed });
});
