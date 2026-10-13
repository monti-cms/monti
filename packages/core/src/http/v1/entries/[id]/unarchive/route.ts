import { versionBodySchema } from "../../../../../core/api";
import { adminRoute, ok, readVersionedBody } from "../../../handler";

/** Archived → draft. Does not republish automatically. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
	return ok(await cms.store().unarchiveEntry({ id: params.id, expectedVersion }));
});
