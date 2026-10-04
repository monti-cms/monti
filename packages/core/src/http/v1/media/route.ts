import { getCmsContentStore, getCmsMediaStore } from "../../../container";
import { mediaListQuerySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readQuery } from "../handler";

/** 미디어 라이브러리(§7.3): 파일명 검색, 형식·업로드일·사용 여부 필터, 최신 업로드순. */
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
