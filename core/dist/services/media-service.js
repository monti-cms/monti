/** Uploads that never completed are cleaned up after this long. */
export const STALE_UPLOAD_AFTER_MS = 24 * 60 * 60 * 1000;
export function createMediaService(deps) {
    /** The one place that takes a media row away: its files first, then the row, so a failure leaves a row that can be tried again. */
    const purge = async (id, keys) => {
        const mediaStore = deps.mediaStore();
        for (const key of keys) {
            if (key)
                await mediaStore.deleteFile({ key });
        }
        await deps.store().finalizeMediaDelete(id);
    };
    return {
        delete: async (id) => {
            const media = await deps.store().beginMediaDelete(id);
            await purge(id, [media.storageKey, media.stagingKey, media.original?.storageKey, media.original?.stagingKey]);
        },
        cleanup: async () => {
            const before = new Date((deps.now?.() ?? new Date()).getTime() - STALE_UPLOAD_AFTER_MS);
            const stale = await deps.store().listStaleUploads({ before });
            let removed = 0;
            const failed = [];
            for (const media of stale) {
                try {
                    // An upload that never completed has no final file, only what was staged.
                    await purge(media.id, [media.stagingKey, media.original?.stagingKey]);
                    removed += 1;
                }
                catch {
                    failed.push(media.id);
                }
            }
            return { removed, failed };
        },
    };
}
