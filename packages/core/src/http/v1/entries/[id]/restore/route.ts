import { getCmsContentService } from "../../../../../container";
import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, json, readVersionedBody } from "../../../handler";

/** Trash → restore. Record collections are validated and returned to the active record. */
export const POST = adminRoute<{ id: string }>(async ({ request, params }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return json(await getCmsContentService().restore({ id: params.id, expectedVersion }));
});
