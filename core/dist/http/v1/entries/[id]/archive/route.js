import { versionBodySchema } from "../../../../../core/api.js";
import { adminRoute, json, readVersionedBody } from "../../../handler.js";
/** Draft/published → archived. Ends publication. */
export const POST = adminRoute(async ({ request, params, cms }) => {
    const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
    return json(await cms.store().archiveEntry({ id: params.id, expectedVersion }));
});
