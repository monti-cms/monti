import { versionBodySchema } from "../../../../../core/api.js";
import { adminRoute, json, readVersionedBody } from "../../../handler.js";
/** Trash → restore. Record collections are validated and returned to the active record. */
export const POST = adminRoute(async ({ request, params, cms }) => {
    const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
    return json(await cms.contentService().restore({ id: params.id, expectedVersion }));
});
