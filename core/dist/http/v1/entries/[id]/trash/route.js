import { versionBodySchema } from "../../../../../core/api.js";
import { adminRoute, ok, readVersionedBody } from "../../../handler.js";
/** Move to trash. Ends publication. */
export const POST = adminRoute(async ({ request, params, cms }) => {
    const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
    return ok(await cms.store().trashEntry({ id: params.id, expectedVersion }));
});
