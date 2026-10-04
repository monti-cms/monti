import { getCmsContentStore, getCmsMediaStore } from "../../../../../container";
import { publishBodySchema } from "../../../../../core/api";
import { imageWarningsForPublish } from "../../../../../core/snapshot";
import { adminRoute, json, readVersionedBody } from "../../../handler";

/**
 * 명시적 발행(§5.2). 저장소가 트랜잭션 안에서 발행 검증을 다시 하고, 실패하면 422와 위치가 있는 `issues`를 준다.
 * 발행일은 처음 발행한 시각이고, `resetPublishedAt`이면 지금으로 바꾼다. 이미지 해석 문제는 비차단 `warnings`로만 알린다(§4.4).
 */
export const POST = adminRoute<{ id: string }>(async ({ request, params }) => {
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
			} catch {
				// 저장소 설정·장애는 DB 판정으로 폴백한다(비차단).
				return true;
			}
		},
	});
	const published = await store.publishEntry({ id: params.id, expectedVersion, resetPublishedAt });
	return json({ ...published, warnings });
});
