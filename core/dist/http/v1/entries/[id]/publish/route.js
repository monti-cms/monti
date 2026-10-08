import { publishBodySchema } from "../../../../../core/api.js";
import { imageWarningsForSnapshot } from "../../../../../core/snapshot.js";
import { adminRoute, json, readVersionedBody } from "../../../handler.js";
/**
 * Explicit publish. The draft goes through the write pipeline (hooks, core preparation), and the store re-checks it for publishing inside the transaction;
 * on failure it returns 422 with located `issues`.
 * The publish date is the first publish time, and `resetPublishedAt` resets it to now. Image resolution problems are reported only as non-blocking `warnings`.
 */
export const POST = adminRoute(async ({ request, params, cms }) => {
    const { expectedVersion, resetPublishedAt } = await readVersionedBody(request, publishBodySchema);
    const store = cms.store();
    const result = await cms.contentService().publish({ id: params.id, expectedVersion, resetPublishedAt }, {
        extraWarnings: (snapshot) => imageWarningsForSnapshot(snapshot, {
            getMediaAsset: (mediaId) => store.getMediaAsset(mediaId),
            headStorageKey: async (storageKey) => {
                try {
                    return (await cms.mediaStore().headFile({ key: storageKey })) !== null;
                }
                catch {
                    // Store config and outages fall back to the DB result (non-blocking).
                    return true;
                }
            },
        }),
    });
    return json(result);
});
