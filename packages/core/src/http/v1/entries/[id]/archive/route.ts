import { getCmsContentStore } from "../../../../../container";
import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, json, readVersionedBody } from "../../../handler";

/** 초안/발행 → 보관. 공개를 끝낸다(§5.3). */
export const POST = adminRoute<{ id: string }>(async ({ request, params }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return json(await getCmsContentStore().archiveEntry({ id: params.id, expectedVersion }));
});
