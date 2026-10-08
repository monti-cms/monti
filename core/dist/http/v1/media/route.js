import { mediaListQuerySchema } from "../../../core/api.js";
import { adminRoute, json, parseWith, readQuery } from "../handler.js";
/** Media library: filename search, filters by type, upload date, and usage, newest upload first. */
export const GET = adminRoute(async ({ request, cms }) => {
    const query = parseWith(mediaListQuerySchema, readQuery(request), "Invalid query parameters");
    const result = await cms.store().listMediaAssets(query);
    const mediaStore = cms.mediaStore();
    return json({
        ...result,
        items: result.items.map((item) => ({
            ...item,
            publicUrl: item.storageKey ? mediaStore.getPublicUrl(item.storageKey) : null,
        })),
    });
});
