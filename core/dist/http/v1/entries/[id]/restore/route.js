import { getCmsContentStore } from "../../../../../container.js";
import { versionBodySchema } from "../../../../../core/api.js";
import { adminRoute, json, readVersionedBody } from "../../../handler.js";
/** Trash → restore. Record collections are validated and returned to the active record. */
export const POST = adminRoute(async ({ request, params }) => {
    const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
    return json(await getCmsContentStore().restoreEntry({ id: params.id, expectedVersion }));
});
