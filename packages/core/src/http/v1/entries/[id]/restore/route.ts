import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, readVersionedBody, written } from "../../../handler";

/** Trash → restore. Record collections are validated and returned to the active record. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return written(cms, await cms.contentService().restore({ id: params.id, expectedVersion }));
});
