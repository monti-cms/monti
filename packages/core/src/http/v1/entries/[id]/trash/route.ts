import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, ok, readVersionedBody } from "../../../handler";

/** Move to trash. Ends publication. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return ok(await cms.store().trashEntry({ id: params.id, expectedVersion }));
});
