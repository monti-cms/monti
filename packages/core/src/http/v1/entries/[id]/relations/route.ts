import { getCmsContentStore } from "../../../../../container";
import { adminRoute, json } from "../../../handler";

/** 이 항목의 사용처(역참조). 초안과 공개본 사용처를 구분한다(§6.1). */
export const GET = adminRoute<{ id: string }>(async ({ params }) => {
	const store = getCmsContentStore();
	await store.getEntry(params.id);
	const relations = await store.getIncomingReferences({ targetId: params.id });
	return json({ targetId: params.id, incomingReferences: relations, total: relations.length });
});
