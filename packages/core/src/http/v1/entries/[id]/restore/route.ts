import { getCmsContentStore } from "../../../../../container";
import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, json, readVersionedBody } from "../../../handler";

/** 휴지통 → 복원. record 컬렉션은 검증 후 활성 레코드로 되돌린다(§5.3). */
export const POST = adminRoute<{ id: string }>(async ({ request, params }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return json(await getCmsContentStore().restoreEntry({ id: params.id, expectedVersion }));
});
