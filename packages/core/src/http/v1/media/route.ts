import { getCmsContentStore, getCmsMediaStore } from "../../../container";
import { mediaListQuerySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readQuery } from "../handler";

/** Media library: filename search, filters by type, upload date, and usage, newest upload first. */
export const GET = adminRoute(async ({ request }) => {
	const query = parseWith(mediaListQuerySchema, readQuery(request), "Invalid query parameters");
	const result = await getCmsContentStore().listMediaAssets(query);
	const mediaStore = getCmsMediaStore();
	return json({
		...result,
		items: result.items.map((item) => ({
			...item,
			publicUrl: item.storageKey ? mediaStore.getPublicUrl(item.storageKey) : null,
		})),
	});
});
