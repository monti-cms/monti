import { getCmsContentService, getCmsContentStore } from "../../../../container";
import { patchEntryBodySchema } from "../../../../core/api";
import { isItemCollection } from "../../../../core/collections";
import type { SaveDraftInput } from "../../../../services/types";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler";

type IdParams = { id: string };

/**
 * 항목과 편집 화면에 필요한 번역 묶음(v2 B4).
 * 번역본이면 원문의 최신 초안 메타데이터(`source`)를 함께 준다. 번역본 속성 패널이 공통 값을 읽기 전용으로 보여 준다.
 */
export const GET = adminRoute<IdParams>(async ({ params }) => {
	const store = getCmsContentStore();
	const entry = await store.getEntry(params.id);
	const translations = isItemCollection(entry.collection)
		? null
		: await store.getTranslationGroup({ entryId: entry.id });
	const source =
		entry.translationGroupId !== entry.id ? await store.getEntry(entry.translationGroupId).catch(() => null) : null;
	return json({
		...entry,
		translations: translations?.members ?? [],
		...(source
			? {
					source: {
						id: source.id,
						locale: source.locale,
						status: source.status,
						workingSlug: source.workingSlug,
						metadata: source.working.metadata,
						// 번역 화면(v3)이 원문 블록과 번역을 나란히 맞춘다.
						mdx: source.working.mdx,
					},
				}
			: {}),
	});
});

/** 최신 초안 저장. 보내지 않은 필드는 현재 초안 값을 유지한다. */
export const PATCH = adminRoute<IdParams>(async ({ request, params }) => {
	const body = await readVersionedBody(request, patchEntryBodySchema);
	const current = await getCmsContentStore().getEntry(params.id);
	const input = {
		collection: current.collection,
		expectedVersion: body.expectedVersion,
		slug: body.slug !== undefined ? body.slug : current.workingSlug,
		metadata: body.metadata ?? current.working.metadata,
		mdx: body.mdx ?? current.working.mdx,
		...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
		...(body.translation !== undefined ? { translation: body.translation } : {}),
	} as SaveDraftInput;
	return json(await getCmsContentService().saveDraft(params.id, input));
});

/** 휴지통 항목의 영구 삭제(§5.3). 휴지통 이동은 `POST /entries/:id/trash`다. */
export const DELETE = adminRoute<IdParams>(async ({ request, params }) => {
	const expectedVersion = readVersionQuery(request);
	await getCmsContentStore().permanentDeleteEntry({ id: params.id, expectedVersion });
	return new Response(null, { status: 204 });
});
