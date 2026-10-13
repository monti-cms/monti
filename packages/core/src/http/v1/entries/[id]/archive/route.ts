import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, ok, readVersionedBody } from "../../../handler";

/** Draft/published → archived. Ends publication. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return ok(await cms.store().archiveEntry({ id: params.id, expectedVersion }));
});
