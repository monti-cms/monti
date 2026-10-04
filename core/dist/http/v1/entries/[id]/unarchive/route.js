import { getCmsContentStore } from "../../../../../container.js";
import { versionBodySchema } from "../../../../../core/api.js";
import { adminRoute, json, readVersionedBody } from "../../../handler.js";
/** Archived → draft. Does not republish automatically. */
export const POST = adminRoute(async ({ request, params }) => {
    const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
    return json(await getCmsContentStore().unarchiveEntry({ id: params.id, expectedVersion }));
});
