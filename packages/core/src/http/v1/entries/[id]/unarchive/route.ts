import { getCmsContentStore } from "../../../../../container";
import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, json, readVersionedBody } from "../../../handler";

/** 보관 → 초안. 자동으로 다시 공개하지 않는다(§5.3). */
export const POST = adminRoute<{ id: string }>(async ({ request, params }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return json(await getCmsContentStore().unarchiveEntry({ id: params.id, expectedVersion }));
});
