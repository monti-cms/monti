import { getCmsContentStore, getCmsMediaStore } from "../../../../../container.js";
import { publishBodySchema } from "../../../../../core/api.js";
import { imageWarningsForPublish } from "../../../../../core/snapshot.js";
import { adminRoute, json, readVersionedBody } from "../../../handler.js";
/**
 * Explicit publish. The store re-validates for publishing inside the transaction and, on failure, returns 422 with located `issues`.
 * The publish date is the first publish time, and `resetPublishedAt` resets it to now. Image resolution problems are reported only as non-blocking `warnings`.
 */
export const POST = adminRoute(async ({ request, params }) => {
    const { expectedVersion, resetPublishedAt } = await readVersionedBody(request, publishBodySchema);
    const store = getCmsContentStore();
    const working = await store.getWorking({ entryId: params.id });
    const warnings = await imageWarningsForPublish({
        collection: working.collection,
        slug: working.slug,
        metadata: working.metadata,
        mdx: working.mdx,
        getMediaAsset: (mediaId) => store.getMediaAsset(mediaId),
        headStorageKey: async (storageKey) => {
            try {
                return (await getCmsMediaStore().headFile({ key: storageKey })) !== null;
            }
            catch {
                // Store config and outages fall back to the DB result (non-blocking).
                return true;
            }
        },
    });
    const published = await store.publishEntry({ id: params.id, expectedVersion, resetPublishedAt });
    return json({ ...published, warnings });
});
