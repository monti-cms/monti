import { getCmsContentStore } from "../../../../../container";
import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, json, readVersionedBody } from "../../../handler";

/** 휴지통 이동. 공개를 끝낸다(§5.3). */
export const POST = adminRoute<{ id: string }>(async ({ request, params }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return json(await getCmsContentStore().trashEntry({ id: params.id, expectedVersion }));
});
